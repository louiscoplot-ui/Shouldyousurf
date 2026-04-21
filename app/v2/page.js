"use client";

// v2 preview route entry.
// Lives at /v2 alongside the prod app at "/". Fetches live Open-Meteo data.

import MainScreen from "./components/MainScreen";

export default function V2Page() {
  return (
    <div className="v2-stage">
      <MainScreen/>
    </div>
  );
}
