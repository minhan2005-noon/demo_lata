CREATE DATABASE IF NOT EXISTS wastewater_monitoring;
USE wastewater_monitoring;

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','operator','viewer') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- DEVICES
-- =====================================================
CREATE TABLE devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_code VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    firmware_version VARCHAR(50),
    status ENUM('online','offline','maintenance') DEFAULT 'offline',
    last_seen DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- SENSOR TYPES
-- =====================================================
CREATE TABLE sensor_types (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    measurement_method VARCHAR(255),
    description TEXT,
    min_value DECIMAL(12,4) NULL,
    max_value DECIMAL(12,4) NULL,
    warning_min DECIMAL(12,4) NULL,
    warning_max DECIMAL(12,4) NULL,
    critical_min DECIMAL(12,4) NULL,
    critical_max DECIMAL(12,4) NULL
);

-- =====================================================
-- SENSORS
-- =====================================================
CREATE TABLE sensors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    sensor_type_id BIGINT NOT NULL,
    sensor_code VARCHAR(50) NOT NULL UNIQUE,
    sensor_name VARCHAR(100),
    measurement_point ENUM('inlet','outlet','process','lab','other') DEFAULT 'process',
    status ENUM('active','inactive','fault') DEFAULT 'active',
    calibration_due_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (device_id)
        REFERENCES devices(id),

    FOREIGN KEY (sensor_type_id)
        REFERENCES sensor_types(id),

    INDEX idx_sensors_device(device_id),
    INDEX idx_sensors_type(sensor_type_id)
);

-- =====================================================
-- SENSOR DATA
-- =====================================================
CREATE TABLE sensor_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    sensor_id BIGINT NOT NULL,
    sensor_type_id BIGINT NOT NULL,
    value DECIMAL(14,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quality ENUM('good','suspect','bad','missing') DEFAULT 'good',
    recorded_at DATETIME NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (device_id)
        REFERENCES devices(id),

    FOREIGN KEY (sensor_id)
        REFERENCES sensors(id),

    FOREIGN KEY (sensor_type_id)
        REFERENCES sensor_types(id),

    INDEX idx_sensor_time(sensor_id, recorded_at),
    INDEX idx_device_time(device_id, recorded_at),
    INDEX idx_type_time(sensor_type_id, recorded_at)
);

-- =====================================================
-- PUMPS
-- =====================================================
CREATE TABLE pumps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    pump_name VARCHAR(100),
    status ENUM('running','stopped','fault') DEFAULT 'stopped',

    FOREIGN KEY (device_id)
        REFERENCES devices(id)
);

-- =====================================================
-- PUMP LOGS
-- =====================================================
CREATE TABLE pump_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pump_id BIGINT NOT NULL,
    action ENUM('start','stop') NOT NULL,
    executed_by BIGINT NULL,
    executed_at DATETIME NOT NULL,

    FOREIGN KEY (pump_id)
        REFERENCES pumps(id),

    FOREIGN KEY (executed_by)
        REFERENCES users(id)
);

-- =====================================================
-- ALERTS
-- =====================================================
CREATE TABLE alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    sensor_id BIGINT NULL,
    alert_type VARCHAR(80) NOT NULL,
    severity ENUM('low','medium','warning','high','critical') NOT NULL,
    message TEXT NOT NULL,
    value DECIMAL(14,4) NULL,
    threshold_value DECIMAL(14,4) NULL,
    status ENUM('active','resolved') DEFAULT 'active',
    created_at DATETIME NOT NULL,
    resolved_at DATETIME NULL,

    FOREIGN KEY (device_id)
        REFERENCES devices(id),

    FOREIGN KEY (sensor_id)
        REFERENCES sensors(id),

    INDEX idx_alerts_device_status(device_id, status),
    INDEX idx_alerts_sensor(sensor_id)
);

-- =====================================================
-- SYSTEM LOGS
-- =====================================================
CREATE TABLE system_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NULL,
    log_level ENUM('info','warning','error') NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    details TEXT,
    created_at DATETIME NOT NULL,

    FOREIGN KEY (device_id)
        REFERENCES devices(id)
);

-- =====================================================
-- DAILY REPORTS
-- =====================================================
CREATE TABLE daily_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NULL,
    report_date DATE NOT NULL,
    avg_flow_in DECIMAL(14,4),
    avg_flow_out DECIMAL(14,4),
    avg_ph DECIMAL(8,3),
    avg_temperature DECIMAL(8,3),
    avg_cod DECIMAL(12,3),
    avg_bod DECIMAL(12,3),
    avg_toc DECIMAL(12,3),
    avg_do DECIMAL(12,3),
    avg_ec DECIMAL(12,3),
    avg_color DECIMAL(12,3),
    avg_ammonium DECIMAL(12,3),
    avg_tss DECIMAL(12,3),
    total_alerts INT DEFAULT 0,
    generated_at DATETIME NOT NULL,

    UNIQUE KEY uniq_daily_report_device_date(device_id, report_date),

    FOREIGN KEY (device_id)
        REFERENCES devices(id)
);

-- =====================================================
-- INITIAL SENSOR TYPES
-- =====================================================
INSERT INTO sensor_types(
    code,
    name,
    unit,
    measurement_method,
    description,
    min_value,
    max_value,
    warning_min,
    warning_max,
    critical_min,
    critical_max
)
VALUES
('flow_in', 'Inlet flow', 'm3/h', 'Ultrasonic flow sensor', 'Influent flow measurement at system inlet', 0, 10000, NULL, NULL, NULL, NULL),
('flow_out', 'Outlet flow', 'm3/h', 'Ultrasonic flow sensor', 'Effluent flow measurement at system outlet', 0, 10000, NULL, NULL, NULL, NULL),
('ph', 'pH', 'pH', 'pH electrode sensor', 'Water pH level', 0, 14, 5.5, 9.0, 4.5, 10.0),
('temperature', 'Temperature', 'C', 'Integrated PT100 sensor', 'Water temperature', -10, 100, NULL, 40, NULL, 50),
('cod', 'COD', 'mg/L', 'UV-VIS spectral probe', 'Chemical Oxygen Demand', 0, 5000, NULL, 150, NULL, 300),
('bod', 'BOD', 'mg/L', 'Estimated/calculated from optical probe model', 'Biochemical Oxygen Demand', 0, 2000, NULL, 50, NULL, 100),
('toc', 'TOC', 'mg/L', 'Estimated/calculated from optical probe model', 'Total Organic Carbon', 0, 2000, NULL, 50, NULL, 100),
('dissolved_oxygen', 'DO', 'mg/L', 'Dissolved oxygen probe', 'Dissolved Oxygen', 0, 20, 2, NULL, 1, NULL),
('electrical_conductivity', 'EC', 'mS/cm', 'Electrical conductivity probe', 'Electrical conductivity', 0, 100, NULL, 5, NULL, 10),
('color', 'Color', 'Pt-Co', 'Optical color measurement', 'Water color', 0, 10000, NULL, 150, NULL, 300),
('ammonium', 'NH4 / Amoni', 'mg/L', 'Ion-selective electrode', 'Ammonium / amoni concentration', 0, 1000, NULL, 10, NULL, 20),
('tss', 'TSS / Turbidity', 'mg/L', 'Infrared light scattering sensor', 'Total Suspended Solids / turbidity equivalent', 0, 10000, NULL, 100, NULL, 200);
