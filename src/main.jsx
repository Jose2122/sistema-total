import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Parche global para evitar el error fatal "Failed to execute 'removeChild/insertBefore/replaceChild' on 'Node'"
// provocado por Google Translate u otras extensiones del navegador al manipular el DOM de React.
if (typeof window !== 'undefined') {
  const nativeRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Evitado error de removeChild:', child);
      }
      return child;
    }
    return nativeRemoveChild.apply(this, arguments);
  };

  const nativeInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Evitado error de insertBefore:', newNode);
      }
      return newNode;
    }
    return nativeInsertBefore.apply(this, arguments);
  };

  const nativeReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function (newChild, oldChild) {
    if (oldChild && oldChild.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Evitado error de replaceChild:', oldChild);
      }
      return oldChild;
    }
    return nativeReplaceChild.apply(this, arguments);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
