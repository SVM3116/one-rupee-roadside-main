// Import logo image from assets folder
import logoImage from "@/assets/logo1.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const Logo = ({ size = "md", showText = true, className = "" }: LogoProps) => {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Image - Use the uploaded image file */}
      {logoImage ? (
        <img 
          src={logoImage} 
          alt="ONE RUPEE RAPIDFIX Logo" 
          className={`${sizeClasses[size]} object-contain`}
        />
      ) : (
        <div className={`${sizeClasses[size]} bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400`}>
          Logo
        </div>
      )}
      
      {/* Brand Name */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <div className={`font-bold ${textSizeClasses[size]} bg-gradient-to-r from-gray-700 via-gray-600 to-orange-600 bg-clip-text text-transparent tracking-tight`}>
            ONE RUPEE
          </div>
          <div className={`font-bold ${textSizeClasses[size]} text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.6)] tracking-tight`}>
            RAPIDFIX.
          </div>
        </div>
      )}
    </div>
  );
};

export default Logo;

