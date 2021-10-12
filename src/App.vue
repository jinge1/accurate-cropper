<template>
  <div class="container">
    <div class="aside">
      <p @click="getClip">
        {{ position }}
      </p>
      <p>
        {{ zoom }}
      </p>
      <p v-if="clipSrc"><img :src="clipSrc" /></p>
    </div>

    <!-- :isAutoViewport="false" -->
    <div class="main">
      <AccurateCropper
        :src="src"
        :zoom.sync="zoom"
        :position.sync="position"
        :isAutoInit.sync="isAutoInit"
        :isAutoPosition.sync="isAutoPosition"
        ref="cropper"
      ></AccurateCropper>
    </div>
  </div>
</template>

<script>
import AccurateCropper from "./components/AccurateCropper.vue";
import girl from "./assets/girl.jpeg";
// 模拟接口请求延迟
const sleep = (delay = 500) =>
  new Promise((resolve) => setTimeout(() => resolve(), delay));
export default {
  components: {
    AccurateCropper,
  },
  data() {
    return {
      src: "",
      zoom: 1,
      position: {},
      isAutoInit: true,
      isAutoPosition: true,
      clipSrc: "",
    };
  },
  created() {
    this.init();
  },
  methods: {
    async init() {
      await sleep(1500);
      this.isAutoPosition = false
      this.position = { left: 281, top: 389, width: 68, height: 345 };
      this.src = girl;
      this.zoom = 1.5;
    },
    /**
     * 获取裁切图片
     */
    async getClip() {
      const src = await this.$refs.cropper.getClipImg();
      this.clipSrc = src;
    },
  },
};
</script>

<style lang="postcss">
body {
  margin: 0;
  padding: 0;
}
.container {
  height: 100vh;
  display: flex;
}
.aside {
  width: 200px;
  background: #d3dce6;
  color: #333;
  text-align: center;
  img {
    max-width: 100%;
  }
}
.main {
  flex: 1;
  overflow: hidden;
}
</style>