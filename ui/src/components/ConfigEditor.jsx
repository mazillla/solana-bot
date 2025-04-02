import React, { useEffect, useState } from 'react';

export const ConfigEditor = () => {
  const [configText, setConfigText] = useState('');
  const [status, setStatus] = useState(null);

  const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001`;

  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then((res) => res.json())
      .then((data) => setConfigText(JSON.stringify(data, null, 2)))
      .catch(() => setStatus('❌ Ошибка при загрузке'));
  }, []);

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(configText);
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        setStatus('✅ Конфигурация успешно сохранена');
      } else {
        const { error } = await res.json();
        setStatus(`❌ Ошибка: ${error}`);
      }
    } catch {
      setStatus('❌ Невалидный JSON');
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>
        <span className="material-symbols-outlined">tune</span>
        Панель управления
      </h1>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <span className="material-symbols-outlined">settings</span>
          Редактор конфигурации
        </h2>

        <textarea
          style={styles.textarea}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
        />

        <div style={styles.actions}>
          <button onClick={handleSave} style={styles.saveButton}>
            <span className="material-symbols-outlined">save</span>
            Сохранить
          </button>
          {status && <span style={styles.status}>{status}</span>}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: 'Roboto, sans-serif',
    color: '#dddddd',
  },
  pageTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '28px',
    marginBottom: '30px',
    color: '#e0e0e0',
  },
  card: {
    width: '100%',
    maxWidth: '960px',
    backgroundColor: '#1e1e1e',
    padding: '24px',
    borderRadius: '14px',
    boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.4)',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '20px',
    marginBottom: '15px',
    color: '#f5f5f5',
  },
  textarea: {
    width: '100%',
    height: '360px',
    fontFamily: 'monospace',
    fontSize: '14px',
    backgroundColor: '#2a2a2a',
    color: '#dddddd',
    border: '1px solid #444',
    borderRadius: '10px',
    padding: '14px',
    resize: 'vertical',
  },
  actions: {
    marginTop: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  saveButton: {
    padding: '10px 22px',
    backgroundColor: '#1a73e8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  status: {
    fontSize: '14px',
    color: '#aaa',
  },
};
