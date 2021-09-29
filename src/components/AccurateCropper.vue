<template>
  <div class="cropper-box">
    <div class="cropper-empty" v-if="!src">
      <slot name="empty">{{ conf.msg }}</slot>
    </div>
    <div class="cropper-section">
      <div class="controls">
        <div class="control-item" v-for="item in buttons" :key="item.action">
          <span class="ratio-text" v-if="item.action === 'zoomText'"
            >{{ parseInt(zoom * 100) }}%</span
          >
          <span class="ratio-text" v-else-if="item.action === 'angleText'"
            >{{ angle }}°</span
          >
          <el-tooltip
            v-else
            class="item"
            effect="dark"
            :content="item.msg || ''"
            :disabled="
              !(typeof item.msg === 'string' && item.msg.trim() !== '')
            "
            placement="top-start"
          >
            <i
              @click="changeAction(item.action)"
              :class="[item.icon, mode === item.action ? 'active' : '']"
            ></i>
          </el-tooltip>
        </div>
        <slot name="top"></slot>
      </div>
      <div class="content" ref="content">
        <canvas ref="canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import { fabric } from "fabric";
// 默认配置信息
const defaultConfig = {
  msg: "请载入裁剪图片",
  zoomStep: 0.05, // 每次放大或缩小数值
  minZoom: 0, // 最小缩放倍数，最小为 0
  maxZoom: 4, // 最大放大倍数，0 为不受限
  fill: "rgba(0,0,0,0.4)", // 遮罩背景
  // 超过该宽度，则move时定义为创建新元素
  createLimit: 10,
};

const updateKeys = ["width", "height", "left", "top", "scaleX", "scaleY"];

export default {
  props: {
    // 配置信息，同defaultConfig
    config: {
      type: Object,
      default: () => ({}),
    },
    // 图片地址
    src: {
      type: String,
      default: "",
    },
    // 旋转角度
    angle: {
      type: Number,
      default: 0,
    },
    // 缩放比例
    zoom: {
      type: Number,
      default: 1,
    },
    // 操作类型 move 整体移动 crop 操作裁剪区
    mode: {
      type: String,
      default: "crop",
    },
    // 图片切换后，是否重置可视区
    isAutoViewport: {
      type: Boolean,
      default: true, // auto 自动设置可视区，same 保持上次信息
    },
    // 裁剪区与信息
    position: {
      type: Object,
      default: () => ({}),
    },
    // 控制按钮
    buttons: {
      type: Array,
      default: () => [
        { icon: "el-icon-zoom-out", action: "zoomOut" }, // 缩小
        { action: "zoomText" }, // 展示缩放值
        { icon: "el-icon-zoom-in", action: "zoomIn" }, // 放大
        { icon: "el-icon-lock", action: "move", msg: "整体移动" }, // 整体移动
        { icon: "el-icon-full-screen", action: "crop", msg: "框选识别区" }, // 设置裁剪区
        { icon: "el-icon-delete", action: "delete", msg: "清除识别区" }, // 清除识别区
        {
          icon: "el-icon-refresh-right",
          action: "rotateRight",
          msg: "顺时针旋转90°",
        },
        // { action: "angleText" }, // 展示缩放值
        {
          icon: "el-icon-refresh-left",
          action: "rotateLeft",
          msg: "逆时针旋转90°",
        },
      ],
    },
  },
  data() {
    return {
      isInit: false, // 是否初始化
      conf: {},
      positionInfo: {},
      canvas: null,
      cropRect: null,
      // preObjs: [],
      // 是否显示裁剪区
      isShowClip: true,
      pathRect: null,
    };
  },
  mounted() {
    this.init();
  },
  methods: {
    init() {
      const { config } = this;
      this.conf = { ...defaultConfig, ...config };
      this.initCanvas();
    },
    /**
     * 初始化画布
     */
    initCanvas() {
      const { src } = this;
      this.canvas = new fabric.Canvas(this.$refs.canvas, {
        preserveObjectStacking: true, // 选中对象不会到最高层，按原层次摆放
        // centeredRotation: true, // 如果为真，则对象使用中心点作为旋转变换的原点
        // centeredScaling: true, // 当为真时，对象使用中心点作为比例变换的起点
        uniformScaling: false, // 是否锁定比例缩放
      });
      this.setCanvasSize();
      window.addEventListener("resize", this.setCanvasSize);
      this.$once("hook:beforeDestroy", () => {
        window.removeEventListener("resize", this.setCanvasSize);
      });
      // 设置画布事件
      this.setCanvasEvents();
      if (src) {
        this.setSrc();
      }
    },
    // 设置事件
    setCanvasEvents() {
      const { canvas } = this;
      let start = null;
      let moveLock = false;
      let isMove = false;
      canvas.on({
        // 切换选中项置顶
        "object:scaling": this.modify,
        // 切换选中项置顶
        "object:moving": this.modify,
        // 鼠标滚动缩放
        "mouse:wheel": ({ e }) => {
          const { conf, zoom } = this;
          const { zoomStep } = conf;
          const { deltaY, offsetX, offsetY } = e;
          let nextzoom = deltaY > 0 ? zoom - zoomStep : zoom + zoomStep;
          nextzoom = this.getCorrectZoom(nextzoom);
          this.setZoom(nextzoom, offsetX, offsetY);
        },
        // 鼠标按下，
        "mouse:down": ({ e, target }) => {
          moveLock = true;
          isMove = false;
          canvas.selection = false; // 拖动不出现背景色块
          if (!target) {
            // 按下区域不为活动对象，则记录起始位置
            const { x, y } = canvas.getPointer(e);
            start = { x, y };
          }
        },
        "mouse:move": ({ e }) => {
          const { mode, conf } = this;
          const { createLimit } = conf;
          const { movementX, movementY } = e;
          if (moveLock && mode === "move") {
            this.setRelativePan(movementX, movementY);
            return false;
          }
          if (!start) {
            return false;
          }
          const { x, y } = canvas.getPointer(e.e);
          const { x: sX, y: sY } = start;
          const width = Math.abs(x - sX);
          const height = Math.abs(y - sY);
          // 移动超过一定范围才当做框选处理
          if (!isMove && width > createLimit && height > createLimit) {
            isMove = true;
          }
          // 根据新框选，更新框选位置
          if (isMove && mode !== "move") {
            const { disX = 0, disY = 0 } = this.getImageInfo() || {};
            const nextInfo = {
              width,
              height,
              left: Math.min(x, sX) - disX,
              top: Math.min(y, sY) - disY,
            };
            this.updatePosition(nextInfo);
            this.updateClip();
          }
        },
        "mouse:up": () => {
          canvas.selection = true;
          moveLock = false;
          start = null;
          this.setActive();
        },
      });
    },
    modify(flg = true) {
      // 同步当前修改内容到截图区
      const { canvas, pathRect } = this;
      const imgInfo = this.getImageInfo();
      if (canvas && !imgInfo) {
        return false;
      }
      const { disX, disY } = imgInfo;
      const active = canvas.getObjects().find((o) => o.objType === "active");
      if (!active) {
        return false;
      }
      const info = updateKeys.reduce((pre, curr) => {
        pre[curr] = active[curr];
        return pre;
      }, {});
      pathRect.set(info);
      this.setActive();
      const { left, top } = info;
      const nextInfo = { ...info, left: left - disX, top: top - disY };
      if (flg) {
        this.updatePosition(nextInfo);
      }
    },
    // 平移画布
    setRelativePan(x, y) {
      const { canvas } = this;
      const point = new fabric.Point(x, y);
      canvas.relativePan(point);
    },
    // 设置裁剪对象为选中状态
    setActive() {
      const { canvas } = this;
      const active = canvas.getObjects().find((o) => o.objType === "active");
      if (!active) {
        return false;
      }
      canvas.setActiveObject(active);
      canvas.renderAll();
    },
    // 更新裁剪区位置
    updateClip() {
      const { canvas, positionInfo } = this;
      const active = canvas.getObjects().find((o) => o.objType === "active");
      if (!active) {
        // 创建裁剪区
        this.drawClip();
        this.isShowClip = true;
        canvas.renderAll();
        return false;
      }
      // 已存在则按更新处理
      active.set(this.getCanvasInfo(positionInfo));
      this.modify(false);
      canvas.renderAll();
    },
    // 显示位置与canvas实际差异处理
    getCanvasInfo(info) {
      const { disX = 0, disY = 0 } = this.getImageInfo() || {};
      const { left, top, ...other } = info;
      return { ...other, left: left + disX, top: top + disY };
    },
    // 更新位置信息
    updatePosition(info) {
      this.positionInfo = info;
      // console.log(info, "info");
      this.$emit("update:position", info);
    },
    /**
     * 控制栏按钮操作
     */
    changeAction(type) {
      // 放大缩小
      if (["zoomOut", "zoomIn"].includes(type)) {
        this.changeZoom(type === "zoomOut" ? -1 : 1);
      }
      // 整体移动与操作裁剪区类型切换
      if (["move", "crop"].includes(type)) {
        const { mode } = this;
        if (mode !== type) {
          const nextMode = mode === "move" ? "crop" : "move";
          this.$emit("update:mode", nextMode);
        }
      }
      // 整体移动与操作裁剪区类型切换
      if (["rotateRight", "rotateLeft"].includes(type)) {
        this.rotate(type === "rotateRight" ? 1 : -1);
      }
      // 删除裁剪区
      if (type === "delete") {
        this.clearClip();
      }
    },
    /**
     * 修改缩放比例
     * flg 1 放大，2 缩小
     */
    changeZoom(flg = 1) {
      const { conf, zoom } = this;
      const { zoomStep, minZoom, maxZoom } = conf;
      // 解决精度问题
      let nextZoom = Number.parseFloat((zoom + zoomStep * flg).toPrecision(6));

      if (flg === 1 && nextZoom > maxZoom) {
        nextZoom = maxZoom;
        this.$message.warning(`最大只能放大${parseInt(maxZoom * 100)}%`);
      }
      if (flg === -1 && nextZoom < minZoom) {
        nextZoom = minZoom;
        this.$message.warning(`最小只能缩小${parseInt(minZoom * 100)}%`);
      }
      this.setZoom(nextZoom);
    },
    /**
     * 旋转背景图
     * flg 1 顺时针旋转90°，-1 逆时针旋转90°
     */
    rotate(flg = 1) {
      const { angle } = this;
      const nextAngle = this.getCorrectAngle(angle + 90 * flg);
      this.setAngle(nextAngle);
      // 具体旋转事件在watch中触发
      this.$emit("update:angle", nextAngle);
      // this.updateAnglePosition(flg);
    },
    /**
     * 旋转角度后更新裁剪框位置，视觉上在同步旋转
     * flg 1 顺时针旋转90°，-1 逆时针旋转90°
     * 待完善
     */
    // updateAnglePosition(flg) {
    //   const { positionInfo } = this;
    //   const { left, top, width, height } = positionInfo;
    //   // const nextInfo = { ...positionInfo, width: height, height: width };
    //   const nextInfo = {
    //     ...positionInfo,
    //     left: 0,
    //     top: left,
    //     width: height,
    //     height: width,
    //   };
    //   // console.log(nextInfo, "nextInfo---");
    //   this.updatePosition(nextInfo);
    //   this.updateClip();
    // },
    /**
     * 获取正确的角度值
     */
    getCorrectAngle(angle) {
      if (angle < 0) {
        return 360 + angle;
      }
      if (angle >= 360) {
        return (angle = angle % 360);
      }
      return angle;
    },
    setZoom(zoom, x, y) {
      const { canvas } = this;
      this.$emit("update:zoom", zoom);
      const pointX = typeof x === "undefined" ? canvas.getWidth() / 2 : x;
      const pointY = typeof y === "undefined" ? canvas.getHeight() / 2 : y;
      const zoomPoint = new fabric.Point(pointX, pointY);
      canvas.zoomToPoint(zoomPoint, zoom);
      // const point = new fabric.Point(x, y);
      // canvas.relativePan(point);
    },
    setAngle(angle) {
      const { canvas, isShowClip } = this;
      const img = canvas.getObjects().find((o) => o.get("type") === "image");
      if (img) {
        img.rotate(angle);
        canvas.renderAll();
      }
      if (isShowClip) {
        // 清除并重绘裁剪区
        this.clearClip(false);
        this.drawClip();
      }
      canvas.renderAll();
    },
    /**
     * 切换图片时的处理
     */
    async setSrc() {
      const {
        canvas,
        src,
        isAutoViewport,
        isShowClip,
        positionInfo,
        position,
      } = this;
      if (!canvas) {
        return false;
      }
      // 记录本次修改前信息
      // this.preObjs = canvas.getObjects();

      // 清除画布
      canvas.clear();
      if (!src) {
        return false;
      }
      // 绘制图片
      const img = await this.getFabricImage(src);
      this.drawImg(img);

      // 图片按比例自动缩放及视觉居中
      if (isAutoViewport) {
        this.setViewport();
        this.$emit("update:isAutoViewport", false);
      }

      // 设置截图位置
      if (Object.keys(positionInfo).length === 0) {
        const defaultInfo = this.getDefaultPosition();
        const info = { ...defaultInfo, ...position };
        this.updatePosition(info);
      }

      // 绘制遮罩
      if (isShowClip) {
        this.drawClip();
      }
      canvas.renderAll();
    },
    // 绘制遮罩内容（info为重新创建信息，默认无）
    drawClip() {
      const { canvas, conf, positionInfo } = this;
      const { fill } = conf;
      const imgInfo = this.getImageInfo();
      if (canvas && !imgInfo) {
        return false;
      }
      // 已有则先清除
      canvas.getObjects().forEach((o) => {
        if (["bg", "active"].includes(o.objType)) {
          canvas.remove(o);
        }
      });
      const { width, height, disX, disY } = imgInfo;

      // 遮罩层
      const bgRect = new fabric.Rect({
        left: disX,
        top: disY,
        width,
        height,
        fill,
      });

      bgRect.set({
        evented: false,
        selectable: false,
        objType: "bg",
      });
      // 矫正坐标
      const exchangeInfo = this.getCanvasInfo(positionInfo);
      // 框选高亮区域
      const pathRect = new fabric.Rect({
        ...exchangeInfo,
        inverted: true,
        absolutePositioned: true,
      });
      bgRect.clipPath = pathRect;
      // 设置统一背景色，视觉上一体
      canvas.set({
        backgroundColor: fill,
      });
      canvas.add(bgRect);
      this.pathRect = pathRect;
      // 操作对象
      const activeRect = new fabric.Rect({
        ...exchangeInfo,
        transparentCorners: false,
        cornerSize: 6, // 控制点大小
        fill: "rgba(0,0,0,0)",
      });
      activeRect.set({
        objType: "active",
      });
      activeRect.setControlsVisibility({
        mtr: false, // 禁用旋转
      });
      canvas.add(activeRect);
      // 设置为选中状态
      this.setActive();
    },
    // 绘制底图
    drawImg(img) {
      const { canvas, angle } = this;
      // 已有则先清除
      canvas.getObjects().forEach((o) => {
        if (o.get("type") === "image") {
          canvas.remove(o);
        }
      });
      img.set({
        evented: false, // 禁用对象事件
        selectable: false, // 对象是否可选择
        objType: "img",
      });
      img.rotate(angle);
      canvas.add(img);
    },
    // 居中视图
    setViewport() {
      const { canvas } = this;
      const imgInfo = this.getImageInfo();
      if (!imgInfo) {
        return false;
      }
      const { width, height, isVertical } = imgInfo;
      const { width: boxWidth, height: boxHeight } = this.getBoxSize();
      // 获取初始缩放比例（若图片尺寸超出canvas，则在横向或纵向与canvas保持一直；否则100%显示）
      const zoom = Math.min(boxWidth / width, boxHeight / height, 1);
      const zoomPoint = new fabric.Point(0, 0);

      // 同步初始缩放比例
      this.$emit("update:zoom", zoom);
      canvas.zoomToPoint(zoomPoint, zoom);

      // 原始中心点
      const lCenter = (boxWidth - width * zoom) / 2;
      const tCenter = (boxHeight - height * zoom) / 2;

      // 未旋转时的中心点
      let l = lCenter;
      let t = tCenter;

      // 转转为纵向时
      if (isVertical) {
        const disX = height / 2 - width / 2;
        const disY = width / 2 - height / 2;
        // console.log(canvas.viewportTransform, disX, disY, 1);
        // 左上角还原到原点
        l = -disX * zoom;
        t = -disY * zoom;

        // 居中
        l = lCenter + l;
        t = tCenter + t;

        // // 存储偏移数据
        // this.disX = disX;
        // this.disY = disY;
      }
      // x, y 若不为0， 则已经发生过位移，需矫正
      const x = canvas.viewportTransform[4];
      const y = canvas.viewportTransform[5];
      canvas.relativePan(new fabric.Point(l - x, t - y));
    },
    // 根据角度获取图片宽高信息
    getImageInfo() {
      const { canvas, angle } = this;
      if (!canvas) {
        return null;
      }
      const img = canvas.getObjects().find((o) => o.get("type") === "image");
      if (!img) {
        return null;
      }
      const { width, height } = img;
      // 旋转角度是否为垂直方向
      const isVertical = Math.round(angle / 90) % 2 === 1;
      const w = isVertical ? height : width;
      const h = isVertical ? width : height;
      const disX = isVertical ? width / 2 - height / 2 : 0;
      const disY = isVertical ? height / 2 - width / 2 : 0;
      return {
        width: w,
        height: h,
        isVertical,
        disX,
        disY,
      };
    },
    // 获取默认截图区
    getDefaultPosition() {
      const { width, height } = this.getImageInfo();
      const ratio = 0.1;
      // 默认选区
      return {
        width: width * (1 - ratio * 2),
        height: height * (1 - ratio * 2),
        left: width * ratio,
        top: height * ratio,
      };
    },
    // 获取fabric图片
    getFabricImage(src) {
      return new Promise((resolve, reject) => {
        fabric.Image.fromURL(src, (img) => {
          resolve(img);
        });
      });
    },
    // 清除裁剪区
    clearClip(flg = true) {
      const { canvas } = this;
      canvas.getObjects().forEach((o) => {
        if (o.get("type") !== "image") {
          canvas.remove(o);
        }
      });
      // 清除背景色
      canvas.set({
        backgroundColor: "rgba(255,255,255, 0)",
      });
      if (flg) {
        this.updatePosition({});
        this.isShowClip = false;
      }
    },
    /**
     * 获取正确放大倍数或判断放大倍数是否合法
     * zoom 缩放值
     * type 1 返回正确缩放比例 2 放回设置值是否正确
     */
    getCorrectZoom(zoom, type = 1) {
      const { conf } = this;
      const { minZoom, maxZoom } = conf;
      let flg = true;
      let correct = zoom;
      if (isNaN(zoom)) {
        correct = 1;
        flg = false;
      }
      if (zoom < minZoom) {
        correct = minZoom;
        flg = false;
      }
      if (maxZoom > 0 && zoom > maxZoom) {
        correct = maxZoom;
        flg = false;
      }
      return type === 1 ? correct : flg;
    },
    /**
     * 数字精度处理
     */
    round(num, n = 6) {
      return Number.parseFloat(num.toPrecision(n));
    },
    // 设置canvas尺寸为父级尺寸
    setCanvasSize() {
      const { canvas } = this;
      const { width, height } = this.getBoxSize();
      canvas.setWidth(width);
      canvas.setHeight(height);
    },
    // 获取canvas父级尺寸
    getBoxSize() {
      const { offsetWidth, offsetHeight } = this.$refs.content;
      return { width: offsetWidth, height: offsetHeight };
    },
    clear() {
      const { canvas } = this;
      canvas.clear();
    },
  },
  watch: {
    // 监听图片地址
    src() {
      this.setSrc();
    },
    // 监听角度
    angle(curr, pre) {
      // 转换为正确的值
      const correctAngle = this.getCorrectAngle(curr);
      // 设置角度值有误，重新设置
      if (correctAngle !== curr) {
        this.$emit("update:angle", correctAngle);
        return false;
      }
      // 新旧值对比，避免死循环
      if (correctAngle !== pre) {
        this.setAngle(curr);
      }
    },
    // 监听位置信息
    position(curr = {}) {
      const { positionInfo } = this;
      const keys = Object.keys(curr);
      if (keys.length > 0 && keys.some((c) => curr[c] !== positionInfo[c])) {
        const defaultScaleInfo = { scaleX: 1, scaleY: 1 };
        this.updatePosition({ ...defaultScaleInfo, ...curr });
        this.updateClip();
      }
    },
  },
};
</script>

<style scoped lang="postcss">
.cropper-box {
  height: 100%;
  position: relative;
}
.cropper-section {
  display: flex;
  flex-flow: column;
  height: 100%;
}
.cropper-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  z-index: 3;
  background: #6d7278;
  color: #fff;
  font-size: 18px;
}
.controls {
  text-align: center;
  display: flex;
  justify-content: center;
  align-content: center;
  padding: 14px 0;
  font-size: 20px;
  /* ::v-deep {
    [class*="el-icon-"] {
      font-size: 20px;
      margin-right: 10px;
    }
  } */
  .control-item {
    margin-right: 20px;
    cursor: pointer;
    text-align: center;
    &:last-child {
      margin: 0;
    }
    .active {
      color: #1890ff;
    }
  }
  .ratio-text {
    width: 3em;
    text-align: center;
    cursor: default;
    font-size: 16px;
  }
  .active {
    color: #1890ff;
  }
}
.content {
  flex: 1;
  overflow: hidden;
  background: url("~@/assets/image/cropper.png") left top repeat;
}
</style>