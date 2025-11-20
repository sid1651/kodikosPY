import React, { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import ACTIONS from "../Actions";
import { initSocketPython } from "../socket";
import toast from "react-hot-toast";
import Client from "../components/Client";
import EditorPython from "../components/EditorPY";
import axios from "axios";

const EditorPY = () => {
  const socketRef = useRef(null);
  const codeRef = useRef("");               // store latest code
  const [clients, setClients] = useState([]);
  const [output,setOutput]=useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();





  /** 🟢 SOCKET INITIALIZATION */
  useEffect(() => {
    async function initSocket() {
      socketRef.current = await initSocketPython();

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username || "Guest",
      });

      socketRef.current.on(ACTIONS.JOINED, ({ clients, username }) => {
        if (username !== location.state?.username) {
          toast.success(`${username} joined`);
        }
        setClients(clients);
      });

      /** RECEIVE LIVE CODE UPDATES */
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null) {
          codeRef.current = code;
        }
      });
    }

    initSocket();
    return () => socketRef.current?.disconnect();
  }, []);

  function leaveRoom() {
    navigate("/");
  }


  const pycodeExecutor= async()=> {
try{
  console.log("Executing Python Code:", codeRef.current);
 const response=await axios.post("http://localhost:5000/api/python/run",{ code:codeRef.current});  
 if(response){
    console.log("Python Code Execution Response:", response);
    setOutput(response.data.output);

 }



}catch(error){
console.error("Error executing Python code:", error);
}
  }


  return (
    <div className="editorPage">
      {/* LEFT SIDEBAR */}
      <div className="aside">
        <h3>👥 Users</h3>

        {clients.map(({ socketId, username }) => (
          <Client key={socketId} username={username} />
        ))}

        <button className="btn" onClick={leaveRoom}>
          🚪 Leave
        </button>
      </div>

      {/* RIGHT SIDE: EDITOR + OUTPUT */}
      <div className="editorRight">
        <EditorPython
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => (codeRef.current = code)}
        />

        <button className="btn run-button" onClick={() => pycodeExecutor()}>
          ▶️ Run Code
        </button>

        <pre className="terminalOutput">
          <div>
            Output:
          </div>
          {output}
        </pre>
      </div>
    </div>
  );
};

export default EditorPY;
