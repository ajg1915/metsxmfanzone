import { memo } from "react";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

export const ClapprPlayer = memo(function ClapprPlayer({
  pageTitle = "Live Stream",
}: ClapprPlayerProps) {
  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        title={pageTitle}
        referrerPolicy="origin"
        src="https://video1.getstreamhosting.com:2000/VideoPlayer/resyweugpd?autoplay=1"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          width: "100%",
          height: "100%",
        }}
        scrolling="no"
        frameBorder="0"
        allow="autoplay; fullscreen"
        allowFullScreen
        webkitallowfullscreen="true"
        mozallowfullscreen="true"
        msallowfullscreen="true"
        oallowfullscreen="true"
      />
    </div>
  );
});

export default ClapprPlayer;
