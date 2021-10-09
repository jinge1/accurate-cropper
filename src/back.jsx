import React, { useState, useEffect, useRef } from "react";
import styled from "@emotion/styled";
import codemirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/lib/codemirror.js";

// 主题
import "codemirror/theme/blackboard.css";
import "codemirror/theme/cobalt.css";

// import "codemirror/mode/javascript/javascript.js";
// 添加 SQL mode
import "codemirror/mode/sql/sql.js";

// 括号匹配
import "codemirror/addon/edit/matchbrackets.js";

// 引入代码自动提示插件
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/sql-hint";
import "codemirror/addon/hint/show-hint";

import { functionList, fieldsList } from "./conf";

// https://www.qiyuandi.com/zhanzhang/zonghe/15315.html
// https://zhuanlan.zhihu.com/p/110888519
// https://codemirror.net/#community
// https://blog.csdn.net/weixin_41697143/article/details/86693542
// https://segmentfault.com/a/1190000016136831

// https://juejin.cn/post/6881954383551021063

const EditBox = styled.div`
  text-align: left;
`;

/**
 * 公式编辑输入组件
 * @param {object} props
 * @returns
 * 函数列表（可手动输入编辑）
 * 字段列表（不可手动输入，只能选择插入与删除）
 */
function CodeEdit(props) {
  const { value = "" } = props;
  const codeRef = useRef(null);
  useEffect(() => {
    const edit = codemirror(codeRef.current, {
      mode: "text/x-mysql",
      theme: "cobalt", // 主题
      indentWithTabs: true,
      smartIndent: true,
      //   readOnly: true,
      //   lineNumbers: true, // 显示行号
      matchBrackets: true, // 开启括号匹配
      autofocus: true,
      // 触发按键
      extraKeys: { Tab: "autocomplete" },
      hintOptions: {
        completeSingle: false, // 当匹配只有一项的时候是否自动补全
        tables: {
          users: ["name", "score", "birthDate"],
          countries: ["name", "population", "size"],
          score: ["zooao"],
        },
        // tables: { "hive.table": ["filed"], abc: ["abcdef"] },
      },
      lineWrapping: true,
      value,
    });
    // cursorActivity 编辑器内容有改动就会触发，也可使用 keypress
    edit.on("cursorActivity", () => {
      // 显示提示
      edit.showHint();
    });
    edit.on("change", (et, change) => {
      console.log(et, change.text);
    });
    // CodeMirror 提供了一个静态方法来支持自定义 hint 功能
    codemirror.registerHelper("hint", "custom", (editor, options) => {
      return { list: ["custom-hint", "abc"] };
    });
    console.log(codeRef);
  }, [value]);
  return (
    <EditBox>
      <div ref={codeRef}></div>
    </EditBox>
  );
}

export default CodeEdit;
