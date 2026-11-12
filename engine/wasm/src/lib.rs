//! Thin WASM boundary over `engine-core`.
//!
//! @since 0.0.1
//! @version 0.1.0

#![forbid(unsafe_code)]

use engine_core::movement::cap_horizontal_speed as core_cap_horizontal_speed;
use wasm_bindgen::prelude::*;

/// Initializes panic hook for better browser diagnostics.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn initEngine() {
    console_error_panic_hook::set_once();
}

/// Exponential damping toward a target value.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn damp(current: f32, target: f32, rate: f32, delta_time_seconds: f32) -> f32 {
    engine_core::math::damp(current, target, rate, delta_time_seconds)
}

/// Clamps a float to [minimum, maximum].
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn clampF32(value: f32, minimum: f32, maximum: f32) -> f32 {
    engine_core::math::clamp_f32(value, minimum, maximum)
}

/// Wraps an angle to [-pi, pi].
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn angleWrap(angle_radians: f32) -> f32 {
    engine_core::math::angle_wrap(angle_radians)
}

/// Caps horizontal speed and returns `[x, z]` as a JS array-compatible tuple via two-value struct.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn capHorizontalSpeedX(velocity_x: f32, velocity_z: f32, max_speed: f32) -> f32 {
    core_cap_horizontal_speed(velocity_x, velocity_z, max_speed).x
}

/// Caps horizontal speed and returns z component.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn capHorizontalSpeedZ(velocity_x: f32, velocity_z: f32, max_speed: f32) -> f32 {
    core_cap_horizontal_speed(velocity_x, velocity_z, max_speed).z
}

/// Integrates x position.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn integrateX(position_x: f32, velocity_x: f32, delta_time_seconds: f32) -> f32 {
    position_x
        + velocity_x
            * if delta_time_seconds.is_finite() {
                delta_time_seconds
            } else {
                0.0
            }
}

/// Integrates y position.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn integrateY(position_y: f32, velocity_y: f32, delta_time_seconds: f32) -> f32 {
    position_y
        + velocity_y
            * if delta_time_seconds.is_finite() {
                delta_time_seconds
            } else {
                0.0
            }
}

/// Integrates z position.
///
/// @since 0.0.1
/// @version 0.1.0
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn integrateZ(position_z: f32, velocity_z: f32, delta_time_seconds: f32) -> f32 {
    position_z
        + velocity_z
            * if delta_time_seconds.is_finite() {
                delta_time_seconds
            } else {
                0.0
            }
}
