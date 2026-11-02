//! Export: writes the Excel workbook. The UI sends the rows; Rust only writes them (ADR 0002).

use rust_xlsxwriter::{Format, Workbook};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

/// One Entry as the user reads it. `date` is "YYYY-MM-DD"; `start` and `end` are text in the zone of the Entry.
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub date: String,
    pub start: String,
    pub end: String,
    pub minutes: u32,
    /// The PSP code of the Category. Empty for an Absence or a Meeting without Category.
    #[serde(default)]
    pub code: String,
    pub category: String,
    pub description: String,
    /// An Absence row. It is listed in sheet 1 but does not count as logged hours.
    #[serde(default)]
    pub absence: bool,
}

/// The Workday location ("Home" or "Office") of one day.
#[derive(Deserialize, Debug, Clone)]
pub struct Day {
    pub date: String,
    pub location: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct Export {
    pub rows: Vec<Row>,
    pub days: Vec<Day>,
}

/// Exact hours. The cells show two decimals but keep the full value, so sums stay right.
fn hours(minutes: u32) -> f64 {
    minutes as f64 / 60.0
}

/// "2026-10-01" as "01.10.2026". Other text stays as it is.
fn dmy(iso: &str) -> String {
    match iso.split('-').collect::<Vec<_>>()[..] {
        [y, m, d] => format!("{d}.{m}.{y}"),
        _ => iso.to_string(),
    }
}

fn build(export: &Export) -> Result<Workbook, String> {
    let location_of: BTreeMap<_, _> = export.days.iter().map(|d| (d.date.as_str(), d.location.as_str())).collect();
    let mut book = Workbook::new();
    let h2 = Format::new().set_num_format("0.00");

    let sheet = book.add_worksheet().set_name("Entries").map_err(|e| e.to_string())?;
    for (c, h) in ["Date", "Start", "End", "Hours", "Code", "Category", "Description", "Location"].iter().enumerate() {
        sheet.write_string(0, c as u16, *h).map_err(|e| e.to_string())?;
    }
    for (i, r) in export.rows.iter().enumerate() {
        let i = i as u32 + 1;
        sheet.write_string(i, 0, dmy(&r.date)).map_err(|e| e.to_string())?;
        sheet.write_string(i, 1, &r.start).map_err(|e| e.to_string())?;
        sheet.write_string(i, 2, &r.end).map_err(|e| e.to_string())?;
        if !r.absence {
            sheet.write_number_with_format(i, 3, hours(r.minutes), &h2).map_err(|e| e.to_string())?;
        }
        sheet.write_string(i, 4, &r.code).map_err(|e| e.to_string())?;
        sheet.write_string(i, 5, &r.category).map_err(|e| e.to_string())?;
        sheet.write_string(i, 6, &r.description).map_err(|e| e.to_string())?;
        sheet.write_string(i, 7, location_of.get(r.date.as_str()).copied().unwrap_or("")).map_err(|e| e.to_string())?;
    }

    // Sheet 2: one row per Category and day, then the day total as its own row. Absences do not count.
    let mut per_day: BTreeMap<&str, BTreeMap<(&str, &str), u32>> = BTreeMap::new();
    for r in export.rows.iter().filter(|r| !r.absence) {
        *per_day.entry(&r.date).or_default().entry((&r.code, &r.category)).or_default() += r.minutes;
    }
    for d in &export.days {
        per_day.entry(&d.date).or_default();
    }
    let sheet = book.add_worksheet().set_name("Hours per day").map_err(|e| e.to_string())?;
    for (c, h) in ["Date", "Location", "Code", "Category", "Hours"].iter().enumerate() {
        sheet.write_string(0, c as u16, *h).map_err(|e| e.to_string())?;
    }
    let mut i = 0;
    for (date, sums) in &per_day {
        let location = location_of.get(date).copied().unwrap_or("");
        let lines = sums.iter().map(|(&(code, name), &m)| (code, name, m)).chain([("", "Total", sums.values().sum())]);
        for (code, name, minutes) in lines {
            i += 1;
            sheet.write_string(i, 0, dmy(date)).map_err(|e| e.to_string())?;
            sheet.write_string(i, 1, location).map_err(|e| e.to_string())?;
            sheet.write_string(i, 2, code).map_err(|e| e.to_string())?;
            sheet.write_string(i, 3, name).map_err(|e| e.to_string())?;
            sheet.write_number_with_format(i, 4, hours(minutes), &h2).map_err(|e| e.to_string())?;
        }
    }
    Ok(book)
}

/// Write the workbook to `path`. It goes to a temporary file in the same folder first, so a failure
/// leaves no partial file and keeps an older export.
pub fn write(path: &Path, export: &Export) -> Result<(), String> {
    let mut book = build(export).map_err(|e| format!("The report could not be built: {e}"))?;
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = Path::new(&tmp);
    let result = book
        .save(tmp)
        .map_err(|e| e.to_string())
        .and_then(|_| std::fs::rename(tmp, path).map_err(|e| e.to_string()));
    if let Err(e) = result {
        let _ = std::fs::remove_file(tmp);
        return Err(format!("The file could not be saved: {e}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use calamine::{open_workbook, Data, Reader, Xlsx};

    fn row(date: &str, minutes: u32, category: &str, description: &str) -> Row {
        Row { date: date.into(), start: "09:00".into(), end: "10:00".into(), minutes, code: format!("P-{category}"), category: category.into(), description: description.into(), absence: false }
    }
    fn sample() -> Export {
        Export {
            rows: vec![row("2026-10-26", 60, "A", "one"), row("2026-10-26", 90, "B", "two"), row("2026-10-27", 30, "A", "three")],
            days: vec![
                Day { date: "2026-10-26".into(), location: "Home".into() },
                Day { date: "2026-10-27".into(), location: "Office".into() },
                Day { date: "2026-10-28".into(), location: "Home".into() },
            ],
        }
    }
    fn text(sheet: &calamine::Range<Data>) -> Vec<Vec<String>> {
        sheet.rows().map(|r| r.iter().map(|c| c.to_string()).collect()).collect()
    }

    #[test]
    fn writes_both_sheets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("report.xlsx");
        write(&path, &sample()).unwrap();
        let mut book: Xlsx<_> = open_workbook(&path).unwrap();
        let entries = text(&book.worksheet_range("Entries").unwrap());
        assert_eq!(entries[0], ["Date", "Start", "End", "Hours", "Code", "Category", "Description", "Location"]);
        assert_eq!(entries[2], ["26.10.2026", "09:00", "10:00", "1.5", "P-B", "B", "two", "Home"]);
        assert_eq!(entries.len(), 4);
        let days = text(&book.worksheet_range("Hours per day").unwrap());
        assert_eq!(
            days,
            [
                ["Date", "Location", "Code", "Category", "Hours"],
                ["26.10.2026", "Home", "P-A", "A", "1"],
                ["26.10.2026", "Home", "P-B", "B", "1.5"],
                ["26.10.2026", "Home", "", "Total", "2.5"],
                ["27.10.2026", "Office", "P-A", "A", "0.5"],
                ["27.10.2026", "Office", "", "Total", "0.5"],
                ["28.10.2026", "Home", "", "Total", "0"],
            ]
        );
        assert!(!dir.path().join("report.xlsx.tmp").exists());
    }

    #[test]
    fn lists_absences_but_does_not_count_them() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("report.xlsx");
        let mut export = sample();
        export.rows.push(Row { absence: true, ..row("2026-10-28", 480, "Absence (not worked)", "Vacation") });
        export.rows.push(Row { absence: true, start: "".into(), end: "".into(), ..row("2026-10-29", 0, "Absence (not worked)", "Leave") }); // full-day
        export.rows.push(row("2026-10-28", 60, "A", "Weekly sync")); // a Meeting counts like an Entry
        write(&path, &export).unwrap();
        let mut book: Xlsx<_> = open_workbook(&path).unwrap();
        let entries = text(&book.worksheet_range("Entries").unwrap());
        assert_eq!(entries.len(), 7);
        assert_eq!(entries[4], ["28.10.2026", "09:00", "10:00", "", "P-Absence (not worked)", "Absence (not worked)", "Vacation", "Home"]);
        assert_eq!(entries[5], ["29.10.2026", "", "", "", "P-Absence (not worked)", "Absence (not worked)", "Leave", ""]);
        let days = text(&book.worksheet_range("Hours per day").unwrap());
        assert_eq!(days.len(), 8, "an Absence adds no day and no Category row");
        assert_eq!(days[7], ["28.10.2026", "Home", "", "Total", "1"]);
    }

    #[test]
    fn failed_export_keeps_old_file_and_leaves_no_partial_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("report.xlsx");
        write(&path, &sample()).unwrap();
        let old = std::fs::read(&path).unwrap();

        let mut too_long = sample();
        too_long.rows[0].description = "x".repeat(40_000); // Excel allows 32767 characters in a cell
        assert!(write(&path, &too_long).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), old);

        let folder_target = dir.path().join("taken");
        std::fs::create_dir(&folder_target).unwrap(); // the rename fails
        assert!(write(&folder_target, &sample()).is_err());
        let names: Vec<_> = std::fs::read_dir(dir.path()).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(names.len(), 2, "only report.xlsx and taken remain: {names:?}");
    }
}
