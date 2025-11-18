import React, { useEffect, useRef } from "react";
import Codemirror from "codemirror";
import "codemirror/mode/python/python";
import "codemirror/theme/dracula.css";
import ACTIONS from "../Actions";
// ⭐ IMPORT ADDONS
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/matchbrackets";
import "codemirror/addon/comment/comment";

import "codemirror/addon/fold/indent-fold";

const EditorPython = ({ socketRef, roomId, onCodeChange }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    editorRef.current = Codemirror.fromTextArea(
      document.getElementById("pythonEditor"),
      {
        mode: "python",
        theme: "dracula",
        lineNumbers: true,
        tabSize: 4,
        indentUnit: 4,
        
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
      }
    );

    editorRef.current.on("change", (instance) => {
      const code = instance.getValue();
      onCodeChange(code);

      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code,
        });
      }
    });

    return () => editorRef.current?.toTextArea();
  }, []);

  /** === SOCKET LISTENER === */
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
      if (code !== editorRef.current.getValue()) {
        editorRef.current.setValue(code);
      }
    });

    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [socketRef.current]);

  return <textarea id="pythonEditor"></textarea>;
};

export default EditorPython;
