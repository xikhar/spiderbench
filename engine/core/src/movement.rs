//! Movement and integration helpers.
//!
//! @since 0.1.0
//! @version 0.1.0

/// Result of capping horizontal speed.
///
/// @since 0.1.0
/// @version 0.1.0
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CappedHorizontalVelocity {
    /// X component after capping.
    pub x: f32,
    /// Z component after capping.
    pub z: f32,
}

/// Caps horizontal (x, z) speed to `max_speed` while preserving direction.
///
/// @since 0.1.0
/// @version 0.1.0
#[must_use]
pub fn cap_horizontal_speed(
    velocity_x: f32,
    velocity_z: f32,
    max_speed: f32,
) -> CappedHorizontalVelocity {
    let safe_max = if max_speed.is_finite() && max_speed >= 0.0 {
        max_speed
    } else {
        0.0
    };
    let speed_sq = velocity_x * velocity_x + velocity_z * velocity_z;
    let max_sq = safe_max * safe_max;
    if !speed_sq.is_finite() || speed_sq <= max_sq || speed_sq <= f32::EPSILON {
        return CappedHorizontalVelocity {
            x: if velocity_x.is_finite() {
                velocity_x
            } else {
                0.0
            },
            z: if velocity_z.is_finite() {
                velocity_z
            } else {
                0.0
            },
        };
    }
    let speed = speed_sq.sqrt();
    if speed <= f32::EPSILON {
        return CappedHorizontalVelocity { x: 0.0, z: 0.0 };
    }
    let scale = safe_max / speed;
    CappedHorizontalVelocity {
        x: velocity_x * scale,
        z: velocity_z * scale,
    }
}

/// Integrates a 3D position by velocity over `delta_time_seconds`.
///
/// Returns `(x, y, z)`.
///
/// @since 0.1.0
/// @version 0.1.0
#[must_use]
pub fn integrate_position(
    position_x: f32,
    position_y: f32,
    position_z: f32,
    velocity_x: f32,
    velocity_y: f32,
    velocity_z: f32,
    delta_time_seconds: f32,
) -> (f32, f32, f32) {
    let dt = if delta_time_seconds.is_finite() {
        delta_time_seconds
    } else {
        0.0
    };
    (
        position_x + velocity_x * dt,
        position_y + velocity_y * dt,
        position_z + velocity_z * dt,
    )
}

#[cfg(test)]
mod tests {
    use super::{cap_horizontal_speed, integrate_position};

    #[test]
    fn cap_horizontal_speed_limits_magnitude() {
        let capped = cap_horizontal_speed(30.0, 40.0, 25.0);
        let speed = (capped.x * capped.x + capped.z * capped.z).sqrt();
        assert!((speed - 25.0).abs() < 1e-4);
    }

    #[test]
    fn integrate_position_advances_linearly() {
        let (x, y, z) = integrate_position(1.0, 2.0, 3.0, 4.0, -1.0, 0.5, 0.5);
        assert_eq!(x, 3.0);
        assert_eq!(y, 1.5);
        assert_eq!(z, 3.25);
    }
}
