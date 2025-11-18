/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [lang, setLang] = useState('');   // ⭐ dropdown language

  const createNewRoom = (e) => {
    e.preventDefault();
    const id = uuidV4();
    setRoomId(id);
    toast.success('New Room Created');
  };

  const joinRoom = () => {
    if (!roomId || !username) {
      toast.error('Room ID & Username required');
      return;
    }

    if (!lang) {
      toast.error('Please select a language');
      return;
    }

    navigate(`/editor/${lang}/${roomId}`, {
      state: { username },
    });
  };

  return (
    <div className="homePageWrapper">
      <div className="formWrapper">
        
        <div className="logoContainer">
          <img src="/logo-dark.png" alt="logo" className="logo" />
          <h2>Kódikos</h2>
        </div>

        <h4 className="mainlabel">Paste Invitation Room ID</h4>

        <div className="inputGroup">
          <input
            type="text"
            className="inputBox"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />

          <input
            type="text"
            className="inputBox"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          {/* ⭐ DROPDOWN HERE */}
          <select
            className="inputBox"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="">Select Language</option>
            <option value="web">HTML / CSS / JS</option>
            <option value="py">Python</option>
          </select>

          <button className="btn joinBtn" onClick={joinRoom}>Join</button>

          <span className="createInfo">
            No invite? Create{' '}
            <a href="#" onClick={createNewRoom} className="createNewBtn">new room</a>
          </span>
        </div>
      </div>

      <footer>
        <h7>© 2025 Kódikos — Collaborative Coding</h7>
      </footer>
    </div>
  );
};

export default Home;
