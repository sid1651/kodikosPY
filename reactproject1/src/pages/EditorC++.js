import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { initSocketCPP } from "../socket";
import ACTIONS from "../Actions";
import { toast } from "react-hot-toast";
import Client from "../components/Client";
import axios from "axios";
import EditorCPP from "../components/EditorC++"

const EditorCPPP = () => {
  const socketRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [image, setImage] = useState([]);

  const { roomId } = useParams();
  const codeRef = useRef(localStorage.getItem(`cppcode_${roomId}`) || "");

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function initSocket() {
      socketRef.current = await initSocketCPP();

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username || "Guest",
      });

      // FIXED: .on() syntax
      socketRef.current.on(ACTIONS.JOINED, ({ clients, username }) => {
        if (username !== location.state?.username) {
          toast.success(`${username} joined`);
        }
        setClients(clients);
      });

      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        codeRef.current = code;
        localStorage.setItem(`cppcode_${roomId}`, code);
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} has left the room`);
        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });
    }

    initSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function leaveRoom() {
    navigate("/");
  }



  const cppcodeExecutor = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND}/api/cpp/run`,
        {
          code: codeRef.current,
        }
      );

      if (response) {
        setOutput(response.data.output);
        setImage(response.data.images);
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


    const clearOutput = () => {
    setOutput("");
    setImage([]);
  };

  const downloadCode = (code, roomId) => {
    const file = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(file);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${roomId}.cpp`; // file name example: abc123.py
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="editorPage">
      {/* LEFT SIDEBAR */}
      <aside
        className={`aside ${isCollapsed ? "collapsed" : ""}`}
        style={{ height: "100vh" }}
      >
        <button
          className="toggle-btn"
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
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
              {clients.map((client) => (
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
        <EditorCPP
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
            localStorage.setItem(`pycode_${roomId}`, code);
          }}
        />
        <div className="buutton-holder">
          <button className="btn run-button" onClick={() => cppcodeExecutor()}>
            ▶️ Run Code
          </button>

          <button className="btn run-button" onClick={() => clearOutput()}>
            Clear
          </button>

          <button
            className="btn run-button"
            onClick={() => downloadCode(codeRef.current, roomId)}
          >
            Download .cpp
          </button>
        </div>

        <pre className="terminalOutput">
          <div>Output:</div>
          {output}
          <div>
            {image.map((img, index) => {
              return (
                <div key={index}>
                  <p>{img.filename}</p>
                  
                  <img
                    src={img.data}
                    alt="Python Output"
                    style={{
                      maxWidth: "400px",
                      border: "1px solid #ccc",
                      marginBottom: "10px",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </pre>
      </div>
    </div>
  );
};

export default EditorCPPP;
