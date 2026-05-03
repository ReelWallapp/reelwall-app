// components/icons/VaultIcon.tsx

import React from "react";
import Svg, { Path } from "react-native-svg";

type VaultIconProps = {
  size?: number;
  locked?: boolean;
};

export default function VaultIcon({
  size = 28,
  locked = false,
}: VaultIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M24 4L40 10V22C40 32 32 40 24 44C16 40 8 32 8 22V10L24 4Z"
        fill="#F5C542"
      />

      <Path
        d="M18 25V21C18 17.7 20.7 15 24 15C27.3 15 30 17.7 30 21V25H27V21C27 19.3 25.7 18 24 18C22.3 18 21 19.3 21 21V25H18Z"
        fill="#0B2545"
      />

      <Path
        d="M16 24H32C33.1 24 34 24.9 34 26V35C34 36.7 32.7 38 31 38H17C15.3 38 14 36.7 14 35V26C14 24.9 14.9 24 16 24Z"
        fill="#0B2545"
      />

      {locked ? (
        <Path
          d="M24 28C22.7 28 21.7 29 21.7 30.3C21.7 31.1 22.1 31.8 22.8 32.2L22 35H26L25.2 32.2C25.9 31.8 26.3 31.1 26.3 30.3C26.3 29 25.3 28 24 28Z"
          fill="#F5C542"
        />
      ) : null}
    </Svg>
  );
}