//! Math helpers used by traversal and simulation code.
//!
//! @since 0.1.0
//! @version 0.1.0

/// Clamps `value` to the inclusive range `[minimum, maximum]`.
///
/// If `minimum > maximum`, the bounds are treated as swapped.
///
/// @since 0.1.0
/// @version 0.1.0
#[must_use]
pub fn clamp_f32(value: f32, minimum: f32, maximum: f32) -> f32 {
    let (lower, upper) = if minimum <= maximum {
        (minimum, maximum)
    } else {
        (maximum, minimum)
    };
    if value < lower {
        lower
    } else if value > upper {
        upper
    } else {
        value
    }
}

/// Exponential damping toward a target value.
///
/// @since 0.1.0
/// @version 0.1.0
#[must_use]
pub fn damp(current: f32, target: f32, rate: f32, delta_time_seconds: f32) -> f32 {
    let safe_rate = if rate.is_finite() && rate >= 0.0 {
        rate
    } else {
        0.0
    };
    let safe_delta = if delta_time_seconds.is_finite() && delta_time_seconds >= 0.0 {
        delta_time_seconds
    } else {
        0.0
    };
    let factor = 1.0 - (-safe_rate * safe_delta).exp();
    current + (target - current) * factor
}

/// Wraps an angle in radians to the range [-pi, pi].
///
/// @since 0.1.0
/// @version 0.1.0
#[must_use]
pub fn angle_wrap(angle_radians: f32) -> f32 {
    if !angle_radians.is_finite() {
        return 0.0;
    }
    angle_radians.sin().atan2(angle_radians.cos())
}

/// Smoothstep interpolation between edges.
///
/// @since 0.1.0
/// @version 0.1.0
#[must_use]
pub fn smooth_step(edge0: f32, edge1: f32, value: f32) -> f32 {
    if !edge0.is_finite() || !edge1.is_finite() || !value.is_finite() {
        return 0.0;
    }
    let denom = edge1 - edge0;
    if denom.abs() <= f32::EPSILON {
        return if value >= edge1 { 1.0 } else { 0.0 };
    }
    let t = clamp_f32((value - edge0) / denom, 0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[cfg(test)]
mod tests {
    use super::{angle_wrap, clamp_f32, damp, smooth_step};

    #[test]
    fn clamp_f32_handles_swapped_bounds() {
        assert_eq!(clamp_f32(5.0, 10.0, 0.0), 5.0);
        assert_eq!(clamp_f32(-1.0, 10.0, 0.0), 0.0);
    }

    #[test]
    fn damp_moves_toward_target() {
        let next = damp(0.0, 10.0, 5.0, 0.016);
        assert!(next > 0.0 && next < 10.0);
    }

    #[test]
    fn angle_wrap_stays_in_range() {
        let wrapped = angle_wrap(std::f32::consts::PI * 3.0);
        assert!((-std::f32::consts::PI..=std::f32::consts::PI).contains(&wrapped));
    }

    #[test]
    fn smooth_step_saturates() {
        assert_eq!(smooth_step(0.0, 1.0, -1.0), 0.0);
        assert_eq!(smooth_step(0.0, 1.0, 2.0), 1.0);
    }
}
