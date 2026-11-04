-- =====================================================================
-- VJU-CALENDAR: HỆ THỐNG QUẢN LÝ VÀ TỰ ĐỘNG SẮP XẾP THỜI KHÓA BIỂU
-- Database Schema for MySQL 8.0
-- Thiết kế chuẩn hóa theo ERD: Untitled diagram-2026-10-28-065235.pdf
-- Nhóm số: 2 (Đảm bảo chất lượng phần mềm theo hướng Scrum)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `vju_calendar` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `vju_calendar_sandbox` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `vju_calendar`;

-- 1. Bảng Điều phối viên (coordinators)
CREATE TABLE IF NOT EXISTS `coordinators` (
    `id` VARCHAR(36) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `phone` VARCHAR(50) NULL,
    `program_code` VARCHAR(50) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng Giảng viên (lecturers)
CREATE TABLE IF NOT EXISTS `lecturers` (
    `id` VARCHAR(36) NOT NULL,
    `lecturer_code` VARCHAR(50) NOT NULL UNIQUE,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `lecturer_type` ENUM('RESIDENT', 'GUEST') NOT NULL DEFAULT 'RESIDENT',
    `coordinator_id` VARCHAR(36) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_lecturers_coordinator`
        FOREIGN KEY (`coordinator_id`) REFERENCES `coordinators` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng Khung giờ có thể dạy của Giảng viên (lecturer_availabilities)
CREATE TABLE IF NOT EXISTS `lecturer_availabilities` (
    `id` VARCHAR(36) NOT NULL,
    `lecturer_id` VARCHAR(36) NOT NULL,
    `day_of_week` SMALLINT NOT NULL COMMENT '0=Thứ 2 ... 6=Chủ nhật',
    `shift` VARCHAR(50) NULL COMMENT 'Sáng, Chiều, Tối',
    `available_periods` JSON NULL COMMENT 'Mảng tiết có thể dạy, vd [1,2,3,4]',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_availabilities_lecturer`
        FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng Học phần / Môn học (courses)
CREATE TABLE IF NOT EXISTS `courses` (
    `id` VARCHAR(36) NOT NULL,
    `course_code` VARCHAR(50) NOT NULL UNIQUE,
    `course_name` VARCHAR(255) NOT NULL,
    `credits` INT NOT NULL DEFAULT 3,
    `theory_periods` INT NOT NULL DEFAULT 30,
    `practice_periods` INT NOT NULL DEFAULT 15,
    `program` VARCHAR(50) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bảng Lớp học phần (classes)
CREATE TABLE IF NOT EXISTS `classes` (
    `id` VARCHAR(36) NOT NULL,
    `class_code` VARCHAR(100) NOT NULL UNIQUE,
    `course_id` VARCHAR(36) NOT NULL,
    `lecturer_id` VARCHAR(36) NULL,
    `cohort` VARCHAR(50) NULL COMMENT 'Khóa học, vd K68',
    `semester` VARCHAR(50) NULL COMMENT 'Học kỳ, vd HK1 2026-2027',
    `expected_students` INT NOT NULL DEFAULT 40,
    `status` VARCHAR(50) NOT NULL DEFAULT 'unassigned',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_classes_course`
        FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_classes_lecturer`
        FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bảng Phòng học (rooms)
CREATE TABLE IF NOT EXISTS `rooms` (
    `id` VARCHAR(36) NOT NULL,
    `room_code` VARCHAR(50) NOT NULL UNIQUE,
    `building` VARCHAR(100) NULL,
    `capacity` INT NOT NULL DEFAULT 50,
    `room_type` VARCHAR(50) NOT NULL DEFAULT 'LT' COMMENT 'LT (Lý thuyết), LAB (Thực hành)',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bảng Thời khóa biểu / Lịch học (schedules)
CREATE TABLE IF NOT EXISTS `schedules` (
    `id` VARCHAR(36) NOT NULL,
    `class_id` VARCHAR(36) NOT NULL,
    `lecturer_id` VARCHAR(36) NULL,
    `room_id` VARCHAR(36) NULL,
    `day_of_week` SMALLINT NOT NULL COMMENT '0=Thứ 2 ... 6=Chủ nhật',
    `start_period` SMALLINT NOT NULL COMMENT 'Tiết bắt đầu (1-12)',
    `end_period` SMALLINT NOT NULL COMMENT 'Tiết kết thúc (1-12)',
    `scheduling_phase` VARCHAR(50) NULL COMMENT 'GUEST, RESIDENT, MANUAL',
    `is_locked` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đã chốt/ghim',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_schedules_class`
        FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_schedules_lecturer`
        FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_schedules_room`
        FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
