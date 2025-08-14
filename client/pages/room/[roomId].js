import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Editor } from "@monaco-editor/react";
import { ChevronUp, ChevronDown } from "lucide-react";
import axios from "axios";
const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
  transports: ["websocket"],
});

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
  const [isPanelOpen, setIsPanelOpen] = useState(false);

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
// Add this debounce helper at the top
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// Inside your component
const emitCodeUpdate = useRef(
  debounce((newValue, roomId) => {
    socket.emit("code-update", newValue, roomId);
  }, 300) // adjust delay as needed
).current;

const handleEditorChange = (newValue) => {
  setCode(newValue);
  emitCodeUpdate(newValue, roomId); // send only after small delay
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
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* ===== Desktop Left Panel ===== */}
      <div className="hidden md:flex md:w-1/3 flex-col border-r p-4">
        {/* Room Activity */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Room Activity</h2>
              <select
                className="p-2 border rounded"
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

            <div className="mt-4 space-y-1 text-sm text-gray-600">
              {messages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </div>
          </div>

          {typingUser && (
            <p className="text-sm italic text-red-500 mt-2">
              {typingUser} is typing...
            </p>
          )}

          <div className="mt-4 flex space-x-3">
            <button
              onClick={leaveRoom}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition duration-200"
            >
              Leave Room
            </button>
            <button
              onClick={copyRoomId}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition duration-200"
            >
              Copy Room ID
            </button>
          </div>
        </div>
      </div>

      {/* ===== Desktop Right Panel / Mobile Main ===== */}
      {/* ===== Desktop Right Panel ===== */}
<div className="flex-1 flex flex-col p-4">
  {/* Editor takes most height */}
  <div className="flex-1 min-h-0">
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={handleEditorChange}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
      }}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        editor.onDidChangeCursorSelection((e) => {
          const position = e.selection.getPosition();
          socket.emit("cursor-change", { roomId, name, position });
        });
        editorRef.current.monaco = monaco;
      }}
    />
  </div>

  {/* Run Button + Output */}
  <div className="mt-2">
    <button
      onClick={handleRun}
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
    >
      Run Code
    </button>
    <div
      className={
        output === "Output will appear here..."
          ? "text-gray-500 mt-2"
          : "bg-black text-white p-4 mt-2 rounded h-[20vh] overflow-y-auto"
      }
    >
      <pre>{output}</pre>
    </div>
  </div>
</div>


      {/* ===== Mobile Bottom Collapsible Panel ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        {/* Toggle Header */}
        <div
          className="flex items-center justify-center py-2 cursor-pointer bg-gray-100"
          onClick={() => setIsPanelOpen((prev) => !prev)}
        >
          {isPanelOpen ? (
            <ChevronDown size={20} />
          ) : (
            <ChevronUp size={20} />
          )}
        </div>

        {/* Collapsible Content */}
        {isPanelOpen && (
          <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-semibold">Language</label>
              <select
                className="p-2 border rounded"
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

            <div>
              <h3 className="text-lg font-semibold mb-2">Room Activity</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {messages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>

            {typingUser && (
              <p className="text-sm italic text-red-500">
                {typingUser} is typing...
              </p>
            )}

            <div className="flex flex-col space-y-2">
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

            {/* <div
              className={
                output === "Output will appear here..."
                  ? "text-gray-500"
                  : "bg-black text-white p-4 rounded h-[15vh] overflow-y-auto"
              }
            >
              <pre>{output}</pre>
            </div> */}
          </div>
        )}
      </div>
    </div>
  );
}