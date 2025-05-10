import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Editor } from "@monaco-editor/react";
import axios from "axios";
const socket = io("http://localhost:5000");
import { runCode } from "../../utils/runCode";

export default function Room() {
  const [language, setLanguage] = useState("javascript");
  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState("// Start coding...");
  const [typingUser, setTypingUser] = useState(null);
  const router = useRouter();
  const { roomId } = router.query;
  const name = router.query.name;
  const isCreator = router.query.isCreater;
  const [output, setOutput] = useState("Output will appear here...");
  const hasJoined = useRef(false);

  let typingTimeout = useRef(null);
  const isTyping = useRef(false);
  const editorRef = useRef(null);
  const decorationRef = useRef([]);
  const emitTypingTimeout = useRef(null);
  useEffect(() => {
    const handleUserJoined = (joinedName) => {
      if (isCreator !== "true" || joinedName !== name) {
        setMessages((prev) => [...prev, `${joinedName} joined the room`]);
      }
    };

    const handleLeftRoom = (leftName) => {
      setMessages((prev) => [...prev, `${leftName} left the room`]);
    };

    const handleCodeUpdated = (newCode) => {
      setCode(newCode);
    };

    const handleRoomCreated = (creatorName) => {
      setMessages((prev) => [...prev, `${creatorName} created the room`]);
    };

    const handleLangUpdated = (newLang) => {
      setLanguage(newLang);
    };

    const handleTyping = (data) => {
      if (data.name !== name) {
        setTypingUser(data.name);
      }
    };
    const handleStopTyping = (data) => {
      if (data.name !== name) {
        setTypingUser(null);
      }
    };
    socket.on("cursor-change", ({ name: remoteName, position }) => {
      if (name !== remoteName) {
        showRemoteCursor(remoteName, position);
      }
    });
    socket.on("current-state", (data)=>{
      if(data.code){
        setCode(data.code);
      }
      if(data.language){
        setLanguage(data.language);
      }
      if(data.output){
        setOutput(data.output);
      }
    });
    socket.on("user-joined", handleUserJoined);
    socket.on("left the room", handleLeftRoom);
    socket.on("code-updated", handleCodeUpdated);
    socket.on("room-created-message", handleRoomCreated);
    socket.on("language-updated", handleLangUpdated);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);
    socket.on("run-code", async ({code,language})=>{
      setOutput("Running..");
      try {
        const result = await runCode(language, code);
        if (result && result.output) {
          setOutput(result.output);
        } else if (result && result.stdout) {
          setOutput(result.stdout);
        } else if (result && result.stderr) {
          setOutput(result.stderr);
        } else {
          setOutput("No output generated");
        }
      } catch (err) {
        console.error("Execution error:", err);
        setOutput("Error: " + err.message);
      }
    });
     if (!hasJoined.current && roomId && name) {
      socket.emit("Joining room", { roomId, name });
      hasJoined.current = true;

      if (isCreator === "true") {
        socket.emit("room-created", { roomId, name });
      }
    }

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("left the room", handleLeftRoom);
      socket.off("code-updated", handleCodeUpdated);
      socket.off("room-created-message", handleRoomCreated);
      socket.off("language-updated", handleLangUpdated);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
      socket.off("cursor-change");
      socket.off("run-code");
      socket.off("current-state");
    };
  }, [roomId, name, isCreator]);

  const handleEditorChange = (newValue) => {
    setCode(newValue);
    socket.emit("code-update", newValue, roomId);
    socket.emit("user-typing", { roomId, name });
    if (emitTypingTimeout.current) {
      clearTimeout(emitTypingTimeout.current);
    }
    emitTypingTimeout.current = setTimeout(() => {
      socket.emit("stop-typing", { roomId, name });
      isTyping.current = false;
    }, 1000);
  };

  const handleLangChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    socket.emit("language-changed", { roomId, language: newLang });
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard
        .writeText(roomId)
        .then(() => alert("Room ID copied to clipboard"))
        .catch((err) => alert("Failed to copy Room ID: " + err));
    }
  };

  const leaveRoom = () => {
    socket.emit("leave-room", { roomId, name });
    router.push("/");
  };

  const handleRun = async () => {
    setOutput("Running...");

    try {
      const result = await runCode(language, code);
      console.log("Result from runCode:", result); // Log the result

      if (result && result.output) {
        setOutput(result.output);
      } else if (result && result.stdout) {
        setOutput(result.stdout);
      } else if (result && result.stderr) {
        setOutput(result.stderr || "No error output");
      } else {
        setOutput("No output generated");
      }
    } catch (err) {
      console.error("Error executing code:", err); // Log any error
      setOutput("Error: " + err.message);
    }
    socket.emit("run-code", {roomId,code,language});
  };

  function showRemoteCursor(name, position) {
    const editor = editorRef.current;
    const monaco = editorRef.current.monaco;
    if (!editor || !monaco || !position) {
      return;
    }
    const decorations = editor.deltaDecorations(decorationRef.current, [
      {
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        options: {
          className: "remote-cursor",
          hoverMessage: { value: `**${name}** is typing here` },
        },
      },
    ]);
    console.log("decorating position for", name,position);
    decorationRef.current = decorations;
  }

  return (
    <div className="flex h-[100vh] overflow-hidden">
      {/* Left: Room Activity + Buttons */}
      <div className="w-1/3 flex flex-col border-r p-4">
        {/* Room Activity */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold mb-2">Room Activity</h2>
              <select
                className="w-2/5 p-2 border rounded ml-auto"
                value={language}
                onChange={handleLangChange}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="html">HTML</option>
              </select>
            </div>
            <div className="mt-4 space-y-2">
              <ul className="text-sm text-gray-600 space-y-1">
                {messages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
          {typingUser && (
            <p className="text-sm italic text-red-500 mt-2">
              {typingUser} is typing...
            </p>
          )}
          {/* Buttons at the bottom */}
          <div className="mt-4 flex space-x-3">
            <button
              onClick={leaveRoom}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition duration-200"
            >
              Leave Room
            </button>

            <button
              onClick={copyRoomId}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition duration-200"
            >
              Copy Room ID
            </button>
          </div>
        </div>
      </div>

      {/* Right: Monaco Editor + Run Button + Output */}
      <div className="w-2/3 flex flex-col p-4">
        {/* Editor */}
        <Editor
          height="70vh"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
          }}
          onMount={(editor,monaco) => {
            editorRef.current = editor;
            editor.onDidChangeCursorSelection((e) => {
              const position = e.selection.getPosition();
              socket.emit("cursor-change", {
                roomId,
                name,
                position,
              });
            });
            editorRef.current.monaco=monaco;
          }}
        />

        {/* Run Button */}
        <button
          onClick={handleRun}
          className="bg-green-600 text-white px-4 py-2 rounded mt-4 self-start hover:bg-green-700 transition"
        >
          Run Code
        </button>

        {/* Output Box */}
        <div
          className={
            output === "Output will appear here..."
              ? "text-gray-500"
              : "bg-black text-white p-4 mt-4 rounded h-[20vh] overflow-y-auto"
          }
        >
          <pre>{output}</pre>
        </div>
      </div>
    </div>
  );
}
