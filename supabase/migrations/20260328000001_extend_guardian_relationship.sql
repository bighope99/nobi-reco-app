-- relationship カラムを VARCHAR(50) に拡張（自由入力続柄対応）
ALTER TABLE _child_guardian
  ALTER COLUMN relationship TYPE VARCHAR(50);
