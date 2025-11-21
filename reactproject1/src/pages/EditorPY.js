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

  // Load saved code
  const { roomId } = useParams();
  const codeRef = useRef(localStorage.getItem(`pycode_${roomId}`) || "");

  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  /** SOCKET INIT */
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

      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        codeRef.current = code;
        localStorage.setItem(`pycode_${roomId}`, code);
      });
    }

    initSocket();
    return () => socketRef.current?.disconnect();
  }, []);

  function leaveRoom() {
    navigate("/");
  }

  const pycodeExecutor = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND}/api/python/run`, {
        code: codeRef.current,
      });

      if (response) {
        setOutput(response.data.output);
      }
    } catch (error) {
      console.error("Error executing Python code:", error);
    }
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID copied!");
    } catch {
      toast.error("Failed to copy Room ID");
    }
  };

  return (
    <div className="editorPage">
      {/* LEFT SIDEBAR */}
      <aside className={`aside ${isCollapsed ? "collapsed" : ""}`} style={{ height: "100vh" }}>
        <button className="toggle-btn" onClick={() => setIsCollapsed(prev => !prev)}>
          {isCollapsed ? ">" : "<"}
        </button>

        {!isCollapsed && (
          <div className="asideInner">
            <div className="logo">
              <img src="/logo-dark.png" alt="logo" className="logo" />
              <h2>Kódikos</h2>
            </div>

            <h3>Connected Users</h3>
            <div className="clientList">
              {clients.map(client => (
                <Client key={client.socketId} username={client.username} />
              ))}
            </div>

            <div className="d-flex-row align-items-end justify-content-center">
              <button className="btn copyBtn" onClick={copyRoomId}>
                Copy Room Id
              </button>
              <button className="btn LeaveBtn" onClick={leaveRoom}>
                Exit Room
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* EDITOR + OUTPUT */}
      <div className="editorRight">
        <EditorPython
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
            localStorage.setItem(`pycode_${roomId}`, code);
          }}
        />

        <button className="btn run-button" onClick={() => pycodeExecutor()}>
          ▶️ Run Code
        </button>

        <pre className="terminalOutput">
          <div>Output:</div>
          {output}
        </pre>
      </div>
    </div>
  );
};

export default EditorPY;
