// content.js for PII Shield India

const ID_PATTERNS = {
  'Aadhaar': {
    pattern: /\b[2-9]\d{3}\s\d{4}\s\d{4}\b|\b[2-9]\d{11}\b/g,
    color: '#ff4d4d' // Red
  },
  'PAN': {
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
    color: '#ffa500' // Orange
  },
  'Voter ID': {
    pattern: /\b[A-Z]{3}\d{7}\b|\b[A-Z]{2}\/\d{2}\/\d{3}\/\d{6}\b/g,
    color: '#4db8ff' // Blue
  },
  'Passport': {
    pattern: /\b[A-Z][0-9]{7}\b/g,
    color: '#a366ff' // Purple
  },
  'DL': {
    pattern: /\b[A-Z]{2}[0-9]{2}[A-Z0-9\s-]{7,11}\b/g,
    color: '#28a745' // Green
  },
  'Ration': {
    pattern: /\b\d{12}\b/g,
    color: '#ffeb3b' // Yellow
  }
};

let realTimeObserver = null;
let isRealTimeEnabled = false;

function scanNode(node) {
  const findings = [];
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent) return findings;
    const tag = parent.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || parent.closest('#pii-shield-side-panel-container')) {
      return findings;
    }

    let text = node.nodeValue;
    let matchesFound = [];

    for (const [type, info] of Object.entries(ID_PATTERNS)) {
      const matches = text.matchAll(info.pattern);
      for (const match of matches) {
        matchesFound.push({
          type,
          value: match[0],
          index: match.index,
          color: info.color
        });
        findings.push({ type, value: match[0] });
      }
    }

    if (matchesFound.length > 0) {
      matchesFound.sort((a, b) => b.index - a.index);
      const fragment = document.createDocumentFragment();
      let lastIndex = text.length;

      matchesFound.forEach(m => {
        if (m.index + m.value.length < lastIndex) {
          fragment.prepend(document.createTextNode(text.substring(m.index + m.value.length, lastIndex)));
        }
        const span = document.createElement('span');
        span.className = 'pii-shield-highlight';
        span.dataset.value = m.value;
        span.textContent = m.value;
        span.style.borderBottom = `3px double ${m.color}`;
        span.style.backgroundColor = `${m.color}33`;
        span.style.cursor = 'pointer';
        span.title = `PII Shield: ${m.type} (Click to remove)`;
        
        span.addEventListener('click', () => {
          const textNode = document.createTextNode(span.textContent);
          span.parentNode.replaceChild(textNode, span);
          document.body.normalize();
        });

        fragment.prepend(span);
        lastIndex = m.index;
      });

      if (lastIndex > 0) {
        fragment.prepend(document.createTextNode(text.substring(0, lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'img') {
    // We'll queue image scanning to avoid performance hits
    setTimeout(() => scanSingleImage(node), 100);
  }
  return findings;
}

async function scanSingleImage(img) {
  const iframe = document.querySelector('#pii-shield-side-panel-container iframe');
  if (!iframe) return;

  try {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
    
    let findings = [];
    let imgHasPII = false;
    for (const [type, info] of Object.entries(ID_PATTERNS)) {
      const matches = text.match(info.pattern);
      if (matches) {
        matches.forEach(match => {
          findings.push({ type: `${type} (Image)`, value: match });
          imgHasPII = true;
        });
      }
    }

    if (imgHasPII) {
      img.style.border = '5px solid #dc3545';
      img.style.boxSizing = 'border-box';
      img.title = 'PII Shield: Potential PII detected in this image';
      iframe.contentWindow.postMessage({ action: 'realTimeFindings', findings }, '*');
    }
  } catch (err) {
    // Silently fail for individual images in real-time
  }
}

function startRealTimeMonitoring() {
  if (realTimeObserver) return;

  realTimeObserver = new MutationObserver((mutations) => {
    let newFindings = [];
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        // Scan text nodes directly
        if (node.nodeType === Node.TEXT_NODE) {
          newFindings = [...newFindings, ...scanNode(node)];
        } 
        // Or scan inside element nodes
        else if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.id === 'pii-shield-side-panel-container') return;
          
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
          let currentNode;
          while (currentNode = walker.nextNode()) {
            newFindings = [...newFindings, ...scanNode(currentNode)];
          }
          // Also check the node itself if it's an image
          newFindings = [...newFindings, ...scanNode(node)];
        }
      });
    });

    if (newFindings.length > 0) {
      const iframe = document.querySelector('#pii-shield-side-panel-container iframe');
      if (iframe) {
        iframe.contentWindow.postMessage({ action: 'realTimeFindings', findings: newFindings }, '*');
      }
    }
  });

  realTimeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  isRealTimeEnabled = true;
}

function stopRealTimeMonitoring() {
  if (realTimeObserver) {
    realTimeObserver.disconnect();
    realTimeObserver = null;
  }
  isRealTimeEnabled = false;
}

function highlightPII() {
  const findings = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || parent.closest('#pii-shield-side-panel-container')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let currentNode;
  while (currentNode = walker.nextNode()) {
    nodes.push(currentNode);
  }

  nodes.forEach(node => {
    let text = node.nodeValue;
    let matchesFound = [];

    for (const [type, info] of Object.entries(ID_PATTERNS)) {
      const matches = text.matchAll(info.pattern);
      for (const match of matches) {
        matchesFound.push({
          type,
          value: match[0],
          index: match.index,
          color: info.color
        });
        findings.push({ type, value: match[0] });
      }
    }

    if (matchesFound.length > 0) {
      matchesFound.sort((a, b) => b.index - a.index);
      const fragment = document.createDocumentFragment();
      let lastIndex = text.length;

      matchesFound.forEach(m => {
        if (m.index + m.value.length < lastIndex) {
          fragment.prepend(document.createTextNode(text.substring(m.index + m.value.length, lastIndex)));
        }
        const span = document.createElement('span');
        span.className = 'pii-shield-highlight';
        span.textContent = m.value;
        span.style.borderBottom = `3px double ${m.color}`;
        span.style.backgroundColor = `${m.color}33`;
        span.title = `PII Shield: ${m.type}`;
        fragment.prepend(span);
        lastIndex = m.index;
      });

      if (lastIndex > 0) {
        fragment.prepend(document.createTextNode(text.substring(0, lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    }
  });

  return findings;
}

function clearHighlights() {
  const highlights = document.querySelectorAll('.pii-shield-highlight');
  highlights.forEach(span => {
    const textNode = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(textNode, span);
  });

  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.style.border = '';
    img.title = '';
  });
  
  // Normalize text nodes to merge adjacent ones
  document.body.normalize();
}

async function scanImages(iframe) {
  const images = Array.from(document.querySelectorAll('img'));
  const findings = [];
  const total = images.length;

  if (total === 0) return [];

  for (let i = 0; i < total; i++) {
    const img = images[i];
    iframe.contentWindow.postMessage({ 
      action: 'ocrProgress', 
      current: i + 1, 
      total: total,
      src: img.src.substring(0, 50) + (img.src.length > 50 ? '...' : '')
    }, '*');

    try {
      const response = await fetch(img.src);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
      
      let imgHasPII = false;
      for (const [type, info] of Object.entries(ID_PATTERNS)) {
        const matches = text.match(info.pattern);
        if (matches) {
          matches.forEach(match => {
            findings.push({ type: `${type} (Image)`, value: match });
            imgHasPII = true;
          });
        }
      }

      if (imgHasPII) {
        img.style.border = '5px solid #dc3545';
        img.style.boxSizing = 'border-box';
        img.title = 'PII Shield: Potential PII detected in this image';
      }
    } catch (err) {
      console.error('OCR Error for image:', img.src, err);
    }
  }

  return findings;
}

function makeDraggable(container) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  // Use a MutationObserver to find the drag handle inside the iframe
  const observer = new MutationObserver(() => {
    const iframe = container.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      const handle = iframe.contentDocument.getElementById('drag-handle');
      if (handle) {
        handle.addEventListener('mousedown', dragStart);
        iframe.contentDocument.addEventListener('mousemove', drag);
        iframe.contentDocument.addEventListener('mouseup', dragEnd);
        observer.disconnect();
      }
    }
  });

  observer.observe(container, { childList: true });

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, container);
    }
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
}

function maskOnPage(value) {
  const highlights = document.querySelectorAll('.pii-shield-highlight');
  highlights.forEach(span => {
    if (span.textContent === value || span.dataset.value === value) {
      span.textContent = '█'.repeat(value.length);
      span.style.backgroundColor = '#000';
      span.style.color = '#fff';
      span.style.borderBottom = 'none';
      span.title = 'PII Masked';
    }
  });
}

function injectTriggerButton() {
  const triggerId = 'pii-shield-trigger';
  if (document.getElementById(triggerId)) return;

  const btn = document.createElement('div');
  btn.id = triggerId;
  btn.innerHTML = '🛡️';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '50px',
    height: '50px',
    backgroundColor: '#0d0d14',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    cursor: 'pointer',
    zIndex: '2147483646',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    border: '2px solid #2d2d3a',
    transition: 'transform 0.2s ease'
  });

  btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
  btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
  btn.addEventListener('click', () => {
    const container = document.getElementById('pii-shield-side-panel-container');
    if (container) {
      container.style.transform = 'translateX(0)';
    } else {
      injectSidePanel();
    }
  });

  document.body.appendChild(btn);
}

function injectSidePanel() {
  const panelId = 'pii-shield-side-panel-container';
  if (document.getElementById(panelId)) return;

  const container = document.createElement('div');
  container.id = panelId;
  
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '320px',
    height: '100vh',
    zIndex: '2147483647',
    boxShadow: '-2px 0 10px rgba(0,0,0,0.3)',
    transition: 'transform 0.3s ease-in-out',
    backgroundColor: '#0d0d14',
    border: 'none',
    margin: '0',
    padding: '0',
    colorScheme: 'dark'
  });

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html');
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none'
  });

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Initialize draggability
  makeDraggable(container);
  
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.action === 'closePanel') {
      container.style.transform = 'translateX(100%)';
      setTimeout(() => container.remove(), 300);
    }
    
    if (event.data && event.data.action === 'scanPage') {
      const textNodesCount = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT).currentNode ? 
                             (() => {
                               let count = 0;
                               const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                               while(w.nextNode()) count++;
                               return count;
                             })() : 0;
      const imagesCount = document.querySelectorAll('img').length;
      
      const textFindings = highlightPII();
      const imageFindings = await scanImages(iframe);
      const allFindings = [...textFindings, ...imageFindings];
      
      iframe.contentWindow.postMessage({ 
        action: 'scanResults', 
        findings: allFindings,
        textNodes: textNodesCount,
        images: imagesCount
      }, '*');
    }

    if (event.data && event.data.action === 'clearHighlights') {
      clearHighlights();
    }

    if (event.data && event.data.action === 'toggleRealTime') {
      if (event.data.enabled) {
        startRealTimeMonitoring();
      } else {
        stopRealTimeMonitoring();
      }
    }
    if (event.data && event.data.action === 'maskOnPage') {
      maskOnPage(event.data.value);
    }
  });
}

injectTriggerButton();
injectSidePanel();