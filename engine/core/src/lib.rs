//! Pure, wasm-agnostic computation helpers for performance-sensitive game math.
//!
//! @since 0.0.1
//! @version 0.1.0

#![forbid(unsafe_code)]

pub mod math;
pub mod movement;

pub use math::{angle_wrap, clamp_f32, damp, smooth_step};
pub use movement::{cap_horizontal_speed, integrate_position};
