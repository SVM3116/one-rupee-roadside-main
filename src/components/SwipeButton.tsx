import { useState, useRef, useEffect } from 'react';
import { Navigation, MapPin, Clock, CheckCircle } from 'lucide-react';

interface SwipeButtonProps {
    currentStatus: string;
    onStatusUpdate: (newStatus: string) => void;
}

const STATUS_CONFIG = {
    accepted: {
        next: 'on_the_way',
        label: 'On The Way',
        icon: Navigation,
        color: '#fb923c', // Orange
    },
    on_the_way: {
        next: 'reached_destination',
        label: 'Reached Destination',
        icon: MapPin,
        color: '#3b82f6', // Blue
    },
    reached_destination: {
        next: 'repair_started',
        label: 'Repair Started',
        icon: Clock,
        color: '#facc15', // Yellow
    },
    repair_started: {
        next: 'repair_completed',
        label: 'Repair Completed',
        icon: CheckCircle,
        color: '#22c55e', // Green
    },
    repair_completed: {
        next: 'completed',
        label: 'Completed',
        icon: CheckCircle,
        color: '#a855f7', // Purple
    },
};

export const SwipeButton = ({ currentStatus, onStatusUpdate }: SwipeButtonProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startXRef = useRef(0);

    const config = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG];

    if (!config) return null;

    const Icon = config.icon;
    const maxDrag = containerRef.current ? containerRef.current.offsetWidth - 60 : 200;
    const threshold = maxDrag * 0.8; // 80% swipe required

    const handleStart = (clientX: number) => {
        setIsDragging(true);
        startXRef.current = clientX;
    };

    const handleMove = (clientX: number) => {
        if (!isDragging) return;

        const diff = clientX - startXRef.current;
        const newPosition = Math.max(0, Math.min(diff, maxDrag));
        setDragPosition(newPosition);
    };

    const handleEnd = () => {
        if (dragPosition >= threshold) {
            // Success! Update status
            setShowSuccess(true);
            setDragPosition(maxDrag);

            setTimeout(() => {
                onStatusUpdate(config.next);
                setDragPosition(0);
                setShowSuccess(false);
            }, 500);
        } else {
            // Snap back
            setDragPosition(0);
        }
        setIsDragging(false);
    };

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleStart(e.clientX);
    };

    const handleMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX);
    };

    const handleMouseUp = () => {
        handleEnd();
    };

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        handleStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
        handleMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        handleEnd();
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, dragPosition]);

    const progress = Math.min((dragPosition / threshold) * 100, 100);

    return (
        <div className="w-full mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Update Status</p>

            <div
                ref={containerRef}
                className="relative h-14 rounded-full overflow-hidden"
                style={{
                    background: `linear-gradient(90deg, ${config.color}15 0%, ${config.color}05 100%)`,
                    border: `2px solid ${config.color}30`,
                }}
            >
                {/* Progress background */}
                <div
                    className="absolute inset-0 transition-all duration-200"
                    style={{
                        background: `linear-gradient(90deg, ${config.color}40 0%, ${config.color}20 ${progress}%, transparent ${progress}%)`,
                    }}
                />

                {/* Swipe text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span
                        className="text-sm font-medium transition-opacity duration-200"
                        style={{
                            color: config.color,
                            opacity: dragPosition < maxDrag * 0.3 ? 1 : 0,
                        }}
                    >
                        Swipe to {config.label} →
                    </span>
                </div>

                {/* Draggable button */}
                <div
                    className="absolute top-1 left-1 h-12 w-12 rounded-full cursor-grab active:cursor-grabbing transition-all duration-200 flex items-center justify-center"
                    style={{
                        transform: `translateX(${dragPosition}px)`,
                        background: config.color,
                        boxShadow: `0 4px 12px ${config.color}60, 0 0 ${showSuccess ? '20px' : '0px'} ${config.color}80`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s',
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    {showSuccess ? (
                        <CheckCircle className="h-6 w-6 text-white animate-bounce" />
                    ) : (
                        <Icon className="h-6 w-6 text-white" />
                    )}
                </div>

                {/* Success checkmark animation */}
                {showSuccess && (
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                            animation: 'ripple 0.6s ease-out',
                        }}
                    >
                        <div
                            className="rounded-full"
                            style={{
                                width: '100%',
                                height: '100%',
                                background: `radial-gradient(circle, ${config.color}40 0%, transparent 70%)`,
                            }}
                        />
                    </div>
                )}
            </div>

            <style>{`
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
        </div>
    );
};
