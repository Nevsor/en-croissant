use std::{collections::VecDeque, path::PathBuf, sync::Mutex};

use diesel::{dsl::sql, sql_types::Bool, Connection, ExpressionMethods, QueryDsl, RunQueryDsl};
use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::{
    api::path::{resolve_path, BaseDirectory},
    Manager,
};

use crate::{
    db::{puzzles, Puzzle},
    error::Error,
};

#[derive(Debug)]
struct PuzzleCache {
    cache: VecDeque<Puzzle>,
    counter: usize,
    min_rating: usize,
    max_rating: usize,
}

impl PuzzleCache {
    fn new() -> Self {
        Self {
            cache: VecDeque::new(),
            counter: 0,
            min_rating: 0,
            max_rating: 0,
        }
    }

    fn get_puzzles(
        &mut self,
        file: &str,
        min_rating: usize,
        max_rating: usize,
    ) -> Result<(), Error> {
        if self.cache.is_empty()
            || self.min_rating != min_rating
            || self.max_rating != max_rating
            || self.counter >= 20
        {
            self.cache.clear();
            self.counter = 0;

            let mut db = diesel::SqliteConnection::establish(file).expect("open database");
            let new_puzzles = puzzles::table
                .filter(puzzles::rating.le(max_rating as i32))
                .filter(puzzles::rating.ge(min_rating as i32))
                .order(sql::<Bool>("RANDOM()"))
                .limit(20)
                .load::<Puzzle>(&mut db)?;

            self.cache = new_puzzles.into_iter().collect();
            self.min_rating = min_rating;
            self.max_rating = max_rating;
        }

        Ok(())
    }

    fn get_next_puzzle(&mut self) -> Option<Puzzle> {
        if let Some(puzzle) = self.cache.get(self.counter) {
            self.counter += 1;
            Some(puzzle.clone())
        } else {
            None
        }
    }
}

#[tauri::command]
pub fn get_puzzle(file: String, min_rating: usize, max_rating: usize) -> Result<Puzzle, Error> {
    static PUZZLE_CACHE: Lazy<Mutex<PuzzleCache>> = Lazy::new(|| Mutex::new(PuzzleCache::new()));

    let mut cache = PUZZLE_CACHE.lock().unwrap();
    cache.get_puzzles(&file, min_rating, max_rating)?;
    cache.get_next_puzzle().ok_or(Error::NoPuzzles)
}

#[derive(Serialize)]
pub struct PuzzleDatabaseInfo {
    title: String,
    description: String,
    puzzle_count: usize,
    storage_size: usize,
    path: String,
}

#[tauri::command]
pub async fn get_puzzle_db_info(
    file: PathBuf,
    app: tauri::AppHandle,
) -> Result<PuzzleDatabaseInfo, Error> {
    let db_path = PathBuf::from("puzzles").join(file);

    let path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        db_path,
        Some(BaseDirectory::AppData),
    )?;

    let mut db =
        diesel::SqliteConnection::establish(&path.to_string_lossy()).expect("open database");

    let puzzle_count = puzzles::table.count().get_result::<i64>(&mut db)? as usize;

    let storage_size = path.metadata()?.len() as usize;
    let filename = path.file_name().expect("get filename").to_string_lossy();

    Ok(PuzzleDatabaseInfo {
        title: filename.to_string(),
        description: "".to_string(),
        puzzle_count,
        storage_size,
        path: path.to_string_lossy().to_string(),
    })
}
