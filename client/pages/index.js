"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [roomIdInput, setRoomIdInput] = useState("");
  const [userName, setUserName] = useState("");
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");

  const createRoom = () => {
    if (!userName.trim()) {
      setError("Enter your name");
      return;
    }
    const id = uuidv4();
    router.push(`/room/${id}?name=${encodeURIComponent(userName)}&isCreater=true`);
  };

  const joinRoom = () => {
    if (!userName.trim() || !roomIdInput.trim()) {
      setError("Enter your name and room ID");
      return;
    }
    router.push(`/room/${roomIdInput}?name=${encodeURIComponent(userName)}`);
  };

  const handleActionChoice = (choice) => {
    setAction(choice);
    setError("");
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url('/back.avif')" }}
      >
        <div className="absolute inset-0 bg-black opacity-40" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center h-full text-white p-6">
        <h1 className="text-4xl mt-15 font-bold mb-6 text-center">
          Welcome to Code Connect
        </h1>
        <p className="text-lg mt-4 text-center max-w-2xl leading-relaxed">
    Collaborate with your team, friends, or peers seamlessly in a shared coding environment. Code Connect allows you to write, test, and debug code together, in real time, no matter where you are. Whether you're pairing up on a project, hosting a coding session, or just sharing ideas, Code Connect is designed to enhance your workflow and foster collaboration.
    Get started instantly and experience smooth, synchronized coding like never before.
  </p>
        {action === null ? (
          <div className="space-y-6">
            <button
              onClick={() => handleActionChoice("create")}
              className="w-45 py-3 mt-10 mr-3 px-6 bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 transition duration-200"
            >
              Create New Room
            </button>
            <button
              onClick={() => handleActionChoice("join")}
              className="w-55 py-3 mt-10 px-6 bg-green-600 rounded-lg shadow-lg hover:bg-green-700 transition duration-200"
            >
              Join an existing Room
            </button>
          </div>
        ) : (
          <div className="space-y-4 w-full max-w-sm">
            <div className="flex flex-col items-center">
              <input
                type="text"
                placeholder="Enter your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full text-black border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {action === "create" ? (
              <button
                onClick={createRoom}
                className="w-full py-3 px-6 bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 transition duration-200"
              >
                Create Room
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <input
                  type="text"
                  placeholder="Enter Room ID"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  className="w-full text-black border px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={joinRoom}
                  className="w-full mt-2 py-3 px-6 bg-green-600 rounded-lg shadow-lg hover:bg-green-700 transition duration-200"
                >
                  Join Room
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
}
