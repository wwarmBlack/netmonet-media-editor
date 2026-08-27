import { useState } from 'react';
import { PRODUCTS } from './products';
import Editor from './Editor';
import './app.css';

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const product = PRODUCTS.find((p) => p.id === selectedId) ?? null;

  if (product) {
    return <Editor product={product} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="picker">
      <header className="picker-header">
        <h1>Редактор макетов</h1>
        <p>Выберите носитель, чтобы отредактировать его макет</p>
      </header>
      <div className="picker-grid">
        {PRODUCTS.map((p) => (
          <button key={p.id} className="product-card" onClick={() => setSelectedId(p.id)}>
            <div
              className={`product-preview shape-${p.shape}`}
              style={{ background: p.defaultBackground, color: p.defaultTextColor }}
            >
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
