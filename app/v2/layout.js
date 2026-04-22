// v2 layout — scopes the prototype CSS to this route only so it doesn't
// collide with the production app at "/".

import "./v2.css";

export const metadata = {
  title: "Should You Surf? — Preview v2",
  description: "Redesign preview. Not the production experience.",
};

export default function V2Layout({ children }) {
  return children;
}
