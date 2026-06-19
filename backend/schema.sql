-- ============================================================
-- SQL SCHEMA - auth_db
-- ============================================================
-- Da eseguire su MySQL 8.0+
-- Charset: utf8mb4 (supporta emoji e caratteri Unicode completi)
-- ============================================================

-- Crea il database se non esiste
CREATE DATABASE IF NOT EXISTS auth_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE auth_db;

-- ============================================================
-- TABELLA: utenti
-- ============================================================
CREATE TABLE IF NOT EXISTS utenti (
  -- Chiave primaria auto-incrementale
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,

  -- Dati anagrafici
  nome            VARCHAR(100)    NOT NULL,
  cognome         VARCHAR(100)    NOT NULL,
  eta             TINYINT UNSIGNED NOT NULL,

  -- Autenticazione
  email           VARCHAR(255)    NOT NULL,
  password        VARCHAR(255)    NOT NULL,

  -- Ruolo e classe
  ruolo           ENUM('studente', 'insegnante') NOT NULL DEFAULT 'studente',
  classe          ENUM('Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta') NOT NULL,

  -- Email verificata
  email_verificata TINYINT(1)     NOT NULL DEFAULT 0,

  -- Sessione - Refresh Token (salvato in chiaro per confronto)
  refresh_token   TEXT            DEFAULT NULL,

  -- Reset password
  reset_password_token  VARCHAR(255) DEFAULT NULL,
  reset_password_expire DATETIME     DEFAULT NULL,

  -- Timestamps (gestiti automaticamente da Sequelize)
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Chiave primaria
  PRIMARY KEY (id),

  -- Indice univoco sull'email (case-insensitive grazie a utf8mb4_unicode_ci)
  UNIQUE KEY uq_utenti_email (email),

  -- Indice per le query di reset password
  KEY idx_utenti_reset_token (reset_password_token),

  -- Indice per filtrare per ruolo
  KEY idx_utenti_ruolo (ruolo)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabella utenti del sistema di autenticazione';


-- ============================================================
-- VERIFICA: mostra la struttura creata
-- ============================================================
DESCRIBE utenti;
SHOW INDEX FROM utenti;
