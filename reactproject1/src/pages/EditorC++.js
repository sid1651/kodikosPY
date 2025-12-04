import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { initSocketCPP } from "../socket";
import ACTIONS from "../Actions";
import { toast } from "react-hot-toast";
import Client from "../components/Client";
import axios from "axios";
import EditorCPP from "../components/EditorC++";
import LogoLoader from "../components/Loder";

const EditorCPPP = () => {
  const socketRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [image, setImage] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // Loader state

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

  // ============================
  // RUN CODE (with loader)
  // ============================
  const cppcodeExecutor = async () => {
    try {
      setLoading(true);
      setOutput("");
      setImage([]);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND}/api/cpp/run`,
        {
          code: codeRef.current,
          input: input, // input for cin
        }
      );

      if (response) {
        setOutput(response.data.output);
      }
    } catch (error) {
      console.error("Error executing C++ code:", error);
      setOutput("Error running code.");
    } finally {
      setLoading(false);
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
    a.download = `${roomId}.cpp`;
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
            localStorage.setItem(`cppcode_${roomId}`, code);
          }}
        />

        <div className="buutton-holder">
          <button
            className="btn run-button"
            disabled={loading}
            onClick={() => cppcodeExecutor()}
          >
            {loading ? "Running..." : "▶️ Run Code"}
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

        {/* TERMINAL OUTPUT */}
        <pre className="terminalOutput">
          <div>Output:</div>

          {loading ? (
            <div className="terminal-loader-wrapper">
              <LogoLoader />
            </div>
          ) : (
            <div>
              {/* INPUT BOX */}
              <textarea
                placeholder="Enter input for cin here..."
                className="input-box"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
              />

              <div>{output}</div>
            </div>
          )}

          {!loading &&
            image.map((img, index) => (
              <div key={index}>
                <p>{img.filename}</p>
                <img
                  src={img.data}
                  alt="CPP Output"
                  style={{
                    maxWidth: "400px",
                    border: "1px solid #ccc",
                    marginBottom: "10px",
                  }}
                />
              </div>
            ))}
        </pre>
      </div>
    </div>
  );
};

export default EditorCPPP;
