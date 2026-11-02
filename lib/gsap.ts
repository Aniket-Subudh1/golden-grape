import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// The one place GSAP's plugin is registered. Scroll-linked motion only; every use goes through
// gsap.matchMedia('(prefers-reduced-motion: no-preference)').
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
