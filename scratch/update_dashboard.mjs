import fs from 'fs';

const path = 'src/Dashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Update Style tag
const newStyle = `style.innerHTML = \\`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .animate-fade { animation: fadeIn 0.4s ease-out; }
      .sidebar { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
      .menu-item:hover { background-color: rgba(255,255,255,0.05) !important; transform: translateX(4px); color: #3b82f6 !important; }
      .stat-card { transition: all 0.3s ease; background-color: #181F31; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
      .stat-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
      .btn-exit-small { transition: all 0.2s ease; cursor: pointer; color: #f87171; border: none; background: rgba(239, 68, 68, 0.1); font-weight: 700; font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; }
      .btn-exit-small:hover { background-color: #ef4444; color: white; }
      
      /* SIDEBAR SEARCH */
      .sidebar-search {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        color: white;
        padding: 8px 12px;
        margin: 10px 15px 25px 15px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }
      .sidebar-search:focus-within {
        background: rgba(255,255,255,0.06);
        border-color: #3b82f6;
      }
      .sidebar-search input {
        background: transparent;
        border: none;
        color: white;
        font-size: 0.85rem;
        width: 100%;
        outline: none;
      }

      .menu-item-new {
        margin: 4px auto;
        padding: 12px 5px;
        border-radius: 14px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        color: #94a3b8;
        font-weight: 500;
        width: 85%;
        text-align: center;
      }
      .menu-item-new:hover {
        background: rgba(255,255,255,0.03);
        color: white;
        transform: translateY(-2px);
      }
      .menu-item-new.active {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
        font-weight: 700;
        box-shadow: inset 0 0 10px rgba(59, 130, 246, 0.05);
      }
      .menu-item-new span {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.3px;
      }
    \\`;`;

content = content.replace(/style\.innerHTML = `[\s\S]*?`;/, newStyle);

// Update Header (more robust regex)
content = content.replace(/backgroundColor: '#f1f5f9'/, "backgroundColor: '#101524'");
content = content.replace(/backgroundColor: 'rgba\(15, 23, 42, 0\.85\)'/, "backgroundColor: '#181F31'");
content = content.replace(/SITC<span style=\{\{ color: '#0ea5e9' \}\}>\.<\/span>/, "SMART<span style={{ color: '#3b82f6' }}>TC</span>");
content = content.replace(/color: '#0ea5e9'/, "color: '#3b82f6'"); // menu toggle color
content = content.replace(/backgroundColor: '#ef4444'/, "backgroundColor: '#f97316'"); // notif dot
content = content.replace(/color: notificacionesLog\.some\(n => n\.nuevo\) \? '#38bdf8' : '#64748b'/, "color: notificacionesLog.some(n => n.nuevo) ? '#f97316' : '#64748b'"); // bell icon
content = content.replace(/ONLINE/, "CONECTADO");

fs.writeFileSync(path, content, 'utf8');
console.log('Dashboard.jsx updated successfully');
