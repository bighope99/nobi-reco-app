type ObservationInput = {
  observation_date: string; // "YYYY-MM-DD"
  content: string;
  objective: string | null;
  subjective: string | null;
  tags: Array<{ name: string }>;
};

type FormatOptions = {
  childName: string;
  grade: number | null;
  fromDate: string;
  toDate: string;
  observations: ObservationInput[];
  maxObservations?: number; // default 100
};

type FormatResult = {
  yaml: string;
  truncated: boolean;
  observationCount: number;
};

/** Indent each line of a block scalar body by the given prefix. */
function indentLines(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => indent + line)
    .join('\n');
}

/**
 * Format a string value as a YAML value.
 * - null → `~`
 * - multi-line → block scalar `|` with indented lines
 * - single-line → plain value (the caller is responsible for appending it inline)
 *
 * Returns the string to place AFTER `key: ` (without trailing newline on the last line).
 * For block scalars the returned string starts with `|\n`.
 */
function formatStringValue(
  value: string | null,
  indent: string
): string {
  if (value === null) {
    return '~';
  }
  if (value.includes('\n')) {
    // Block scalar: `|` followed by indented content
    const indented = indentLines(value, indent);
    return `|\n${indented}`;
  }
  return value;
}

export function formatObservationsToYaml(options: FormatOptions): FormatResult {
  const {
    childName,
    grade,
    fromDate,
    toDate,
    observations,
    maxObservations = 100,
  } = options;

  // Sort ascending by date
  const sorted = [...observations].sort((a, b) =>
    a.observation_date.localeCompare(b.observation_date)
  );

  const truncated = sorted.length > maxObservations;
  const included = truncated ? sorted.slice(0, maxObservations) : sorted;
  const observationCount = included.length;

  // Build YAML manually to meet all formatting rules
  const lines: string[] = [];

  lines.push('child:');
  lines.push(`  name: ${childName}`);
  lines.push(`  grade: ${grade === null ? '~' : grade}`);
  lines.push('period:');
  lines.push(`  from: "${fromDate}"`);
  lines.push(`  to: "${toDate}"`);
  lines.push(`total_observations: ${observationCount}`);

  if (included.length === 0) {
    lines.push('observations: []');
  } else {
    lines.push('observations:');
    for (const obs of included) {
      lines.push(`  - date: "${obs.observation_date}"`);

      // content
      const contentVal = formatStringValue(obs.content, '      ');
      if (contentVal.startsWith('|\n')) {
        lines.push(`    content: ${contentVal}`);
      } else {
        lines.push(`    content: ${contentVal}`);
      }

      // objective
      const objectiveVal = formatStringValue(obs.objective, '      ');
      if (objectiveVal.startsWith('|\n')) {
        lines.push(`    objective: ${objectiveVal}`);
      } else {
        lines.push(`    objective: ${objectiveVal}`);
      }

      // subjective
      const subjectiveVal = formatStringValue(obs.subjective, '      ');
      if (subjectiveVal.startsWith('|\n')) {
        lines.push(`    subjective: ${subjectiveVal}`);
      } else {
        lines.push(`    subjective: ${subjectiveVal}`);
      }

      // tags
      if (obs.tags.length === 0) {
        lines.push('    tags: []');
      } else {
        lines.push('    tags:');
        for (const tag of obs.tags) {
          lines.push(`      - ${tag.name}`);
        }
      }
    }
  }

  const yaml = lines.join('\n') + '\n';

  return { yaml, truncated, observationCount };
}
