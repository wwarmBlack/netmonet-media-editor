import { useEffect, useState } from 'react';
import { PRODUCTS } from './layouts';
import Editor from './Editor';
import './app.css';

const SELECTED_KEY = 'menu-editor-selected-product';

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });
  const product = PRODUCTS.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId);
      else localStorage.removeItem(SELECTED_KEY);
    } catch {
      /* ignore */
    }
  }, [selectedId]);

  if (product) {
    return <Editor product={product} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="picker">
      <header className="picker-header">
        <h1>Редактор макетов</h1>
        <p>Выберите носитель — откроется его базовый макет, готовый к редактированию</p>
      </header>
      <div className="picker-grid">
        {PRODUCTS.map((p) => (
          <button key={p.id} className="product-card" onClick={() => setSelectedId(p.id)}>
            <div className="product-preview">
              <span>{p.name}</span>
            </div>
            <div className="product-info">
              <strong>{p.name}</strong>
              <small>{p.description}</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
