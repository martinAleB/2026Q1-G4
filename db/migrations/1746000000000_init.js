exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE fintech (
      sub          VARCHAR PRIMARY KEY,
      nombre       VARCHAR UNIQUE,
      max_sit_bcra INTEGER
    );

    CREATE TABLE producto (
      id           SERIAL PRIMARY KEY,
      sub          VARCHAR NOT NULL,
      nombre       VARCHAR NOT NULL,
      monto        DOUBLE PRECISION NOT NULL,
      cuotas       INTEGER NOT NULL,
      interes      DOUBLE PRECISION NOT NULL,
      plazo        INTEGER NOT NULL,
      min_sit_cred INTEGER NOT NULL,
      max_sit_cred INTEGER NOT NULL,
      CONSTRAINT fk_producto_fintech FOREIGN KEY (sub) REFERENCES fintech(sub)
    );

    CREATE TABLE usuario (
      sub  VARCHAR NOT NULL,
      cuit VARCHAR(11) NOT NULL,
      CONSTRAINT pk_usuario PRIMARY KEY (sub, cuit),
      CONSTRAINT fk_usuario_fintech FOREIGN KEY (sub) REFERENCES fintech(sub)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE usuario;
    DROP TABLE producto;
    DROP TABLE fintech;
  `);
};
