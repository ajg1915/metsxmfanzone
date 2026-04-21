import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  priority?: boolean;
  /** Sets fetchpriority="high" + eager loading for LCP images. */
  fetchPriority?: 'high' | 'low' | 'auto';
}

/**
 * SEO note: `alt` is required and should describe the image content
 * (e.g. "Pete Alonso batting at Citi Field" — not "image" or "photo").
 * Provide width/height (or aspect via className) to prevent layout shift (CLS).
 */

/**
 * OptimizedImage component with lazy loading and fade-in effect
 * Uses native lazy loading with a blur-up placeholder effect
 */
const OptimizedImage = ({
  src,
  alt,
  placeholder,
  priority = false,
  fetchPriority,
  className = '',
  ...props
}: OptimizedImageProps) => {
  const computedFetchPriority = fetchPriority ?? (priority ? 'high' : undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Start loading 200px before visible
        threshold: 0,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* Placeholder/skeleton */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-muted/50 animate-pulse"
          style={{
            backgroundImage: placeholder ? `url(${placeholder})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: placeholder ? 'blur(10px)' : undefined,
          }}
        />
      )}
      
      {/* Actual image */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // @ts-expect-error - fetchpriority is a valid HTML attribute, not yet typed in React
          fetchpriority={computedFetchPriority}
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        />
      )}
    </div>
  );
};

export default OptimizedImage;
