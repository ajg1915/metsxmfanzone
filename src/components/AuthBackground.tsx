import { motion } from "framer-motion";
import { useBackgroundSettings } from "@/hooks/useBackgroundSettings";

const AuthBackground = ({ mode = "login" }: { mode?: "login" | "signup" }) => {
  const { data: modeBackground } = useBackgroundSettings(mode === "signup" ? "auth_signup" : "auth_login");
  const { data: sharedBackground } = useBackgroundSettings("auth");
  const background = modeBackground ?? sharedBackground;

  // Dynamic background style based on settings
  const getDynamicBackground = () => {
    if (!background) {
      // Default gradient if no background is set
      return {
        background: "linear-gradient(135deg, #002D72 0%, #001a42 50%, #0a0a0a 100%)",
      };
    }

    switch (background.background_type) {
      case "image": {
        const v = background.background_value.trim();
        const backgroundImage = v.startsWith("url(") ? v : `url(${v})`;
        return {
          backgroundImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        };
      }
      case "gradient":
        return {
          background: background.background_value,
        };
      case "color":
        return {
          backgroundColor: background.background_value,
        };
      default:
        return {
          background: "linear-gradient(135deg, #002D72 0%, #001a42 50%, #0a0a0a 100%)",
        };
    }
  };

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Dynamic background layer */}
      <div className="absolute inset-0 transition-all duration-500" style={getDynamicBackground()} />
      
      {/* Animated baseball stitches pattern - only show for non-image backgrounds */}
      {background?.background_type !== "image" && (
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="stitches" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path
                d="M25 0 C 30 25, 20 50, 25 75 C 30 100, 25 100, 25 100"
                stroke="#FF5910"
                strokeWidth="2"
                fill="none"
                strokeDasharray="4 4"
              />
              <path
                d="M75 0 C 70 25, 80 50, 75 75 C 70 100, 75 100, 75 100"
                stroke="#FF5910"
                strokeWidth="2"
                fill="none"
                strokeDasharray="4 4"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#stitches)" />
        </svg>
      )}

      {/* Floating orbs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-gradient-to-r from-[#FF5910]/20 to-transparent blur-3xl"
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-gradient-to-l from-[#002D72]/40 to-transparent blur-3xl"
        animate={{
          x: [0, -40, 0],
          y: [0, -20, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-gradient-to-tr from-[#FF5910]/15 to-[#002D72]/20 blur-3xl"
        animate={{
          x: [0, 30, 0],
          y: [0, -40, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Geometric shapes */}
      <motion.div
        className="absolute top-20 right-20 w-4 h-4 bg-[#FF5910]/30 rounded-full"
        animate={{
          y: [0, -15, 0],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute top-1/3 left-20 w-3 h-3 bg-[#002D72]/50 rounded-full"
        animate={{
          y: [0, 20, 0],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      />
      
      <motion.div
        className="absolute bottom-32 right-1/4 w-2 h-2 bg-[#FF5910]/40 rounded-full"
        animate={{
          y: [0, -10, 0],
          x: [0, 10, 0],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      {/* Baseball silhouette */}
      <motion.div
        className="absolute bottom-10 right-10 opacity-5"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="95" stroke="#FF5910" strokeWidth="4" />
          <path
            d="M30 100 C 50 60, 80 40, 100 35 C 120 40, 150 60, 170 100"
            stroke="#FF5910"
            strokeWidth="3"
            fill="none"
            strokeDasharray="8 6"
          />
          <path
            d="M30 100 C 50 140, 80 160, 100 165 C 120 160, 150 140, 170 100"
            stroke="#FF5910"
            strokeWidth="3"
            fill="none"
            strokeDasharray="8 6"
          />
        </svg>
      </motion.div>

      {/* Grid overlay - only show for non-image backgrounds */}
      {background?.background_type !== "image" && (
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,89,16,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,89,16,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      )}

      {/* Vignette effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
    </div>
  );
};

export default AuthBackground;
