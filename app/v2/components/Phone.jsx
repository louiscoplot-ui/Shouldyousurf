"use client";

// v2 Phone frame + StatusBar — ported from export-v2/v2-shared.jsx.

function StatusBar() {
  return (
    <div className="status">
      <span>9:41</span>
      <div className="glyphs">
        <svg width="15" height="11" viewBox="0 0 16 11">
          <path d="M3 9 L8 5 L13 9 M5 10.5 L8 8 L11 10.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <div className="bars"><span/><span/><span/><span/></div>
        <div className="batt"><span style={{ width: "78%" }}/></div>
      </div>
    </div>
  );
}

export default function Phone({ children }) {
  return (
    <div className="phone">
      <StatusBar/>
      <div className="viewport">{children}</div>
    </div>
  );
}
