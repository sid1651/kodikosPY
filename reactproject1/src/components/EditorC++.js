import codemirror from 'codemirror';
import CodeMirror from 'codemirror'
import React, { useEffect, useRef } from 'react'
import "codemirror/mode/clike/clike"
import "codemirror/theme/dracula.css";
import ACTIONS from '../Actions';

 import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/matchbrackets";
import "codemirror/addon/comment/comment";
import "codemirror/addon/fold/indent-fold";

const EditorCPP=({socketRef,roomId,onCodeChange})=>{
    const editorRef=useRef(null);


    useEffect(()=>{
const saved=localStorage.getItem(`cppcode_${roomId}`,)|| ""


editorRef.current=CodeMirror.fromTextArea(
    document.getElementById("cppEditor"),{
        mode:'text/x-c++src',
        theme: "dracula",
        lineNumbers: true,
        tabSize: 4,
        indentUnit: 4,
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
    }
)
editorRef.current.setValue(saved)
onCodeChange(saved)

editorRef.current.on("change", (instance) => {
      const code = instance.getValue();
      onCodeChange(code);

      // Save to localStorage
      localStorage.setItem(`cppcode_${roomId}`, code);

      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code,
        });
      }
    });



return ()=>editorRef.current?.toTextArea();
    },[])


    useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
      if (code !== editorRef.current.getValue()) {
        editorRef.current.setValue(code);
        localStorage.setItem(`cppcode_${roomId}`, code);
      }
    });

    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [socketRef.current]);
   return <textarea id="cppEditor"></textarea>;
}

export default EditorCPP