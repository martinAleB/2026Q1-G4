exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS portfolio_cuits (
        cuit                  VARCHAR(11) PRIMARY KEY,
        current_status        SMALLINT NOT NULL DEFAULT 1,
        previous_status       SMALLINT NOT NULL DEFAULT 1,
        trend                 VARCHAR(10) NOT NULL DEFAULT 'stable',
        last_updated          TIMESTAMPTZ,
        last_processed_period VARCHAR(7),
        situacion             SMALLINT,
        cant_entidades        SMALLINT,
        deuda_total_ars       DECIMAL(15,2),
        meses_en_sit1         SMALLINT,
        dias_atraso_max       SMALLINT,
        proceso_judicial      BOOLEAN DEFAULT FALSE,
        score                 DECIMAL(5,4),
        features_updated_at   TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS portfolio_tracking (
        fintech_sub VARCHAR(128) NOT NULL,
        cuit        VARCHAR(11) NOT NULL REFERENCES portfolio_cuits(cuit) ON DELETE CASCADE,
        tracked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (fintech_sub, cuit)
    );

    CREATE INDEX IF NOT EXISTS idx_tracking_fintech ON portfolio_tracking(fintech_sub);
    CREATE INDEX IF NOT EXISTS idx_cuits_score ON portfolio_cuits(score);
    CREATE INDEX IF NOT EXISTS idx_cuits_situacion ON portfolio_cuits(situacion);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_cuits_situacion;
    DROP INDEX IF EXISTS idx_cuits_score;
    DROP INDEX IF EXISTS idx_tracking_fintech;
    DROP TABLE IF EXISTS portfolio_tracking;
    DROP TABLE IF EXISTS portfolio_cuits;
  `);
};
