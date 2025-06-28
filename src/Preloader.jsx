import React, { useEffect, useState } from "react";

const SPINNER_COLOR = "#d62338"; // Change this to any color you want
const BAR_COUNT = 12;
const ANIMATION_SPEED = 80; // ms per frame

const Preloader = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % BAR_COUNT);
    }, ANIMATION_SPEED);
    return () => clearInterval(interval);
  }, []);

  // Opacity gradient for trailing bars
  const opacities = [1, 0.85, 0.7, 0.55, 0.4, 0.25];
  const getOpacity = (i) => {
    let diff = (i - active + BAR_COUNT) % BAR_COUNT;
    return opacities[diff] || 0.15;
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black z-50">
      <svg width="80" height="80" viewBox="0 0 50 50">
        {[...Array(BAR_COUNT)].map((_, i) => (
          <rect
            key={i}
            x="23"
            y="6"
            width="4"
            height="12"
            rx="2"
            fill={SPINNER_COLOR}
            opacity={getOpacity(i)}
            transform={`rotate(${i * (360 / BAR_COUNT)} 25 25)`}
          />
        ))}
      </svg>
      <div className="mt-8 text-3xl text-gray-400 font-bold tracking-widest text-center">
        ONE SEC
      </div>
    </div>
  );
};

export default Preloader;