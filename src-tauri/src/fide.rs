use std::{
    fs::{remove_file, File},
    io::{BufReader, BufWriter},
};

use bincode::{config, Decode, Encode};
use quick_xml::de::from_reader;
use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;
use strsim::jaro_winkler;
use tauri::{
    api::path::{app_config_dir, resolve_path, BaseDirectory},
    Manager,
};

use crate::error::Error;
use crate::{fs::download_file, AppState};

#[derive(Debug, Deserialize, Serialize, Type, Clone, Decode, Encode)]
pub struct FidePlayer {
    pub fideid: u32,
    pub name: String,
    pub country: String,
    pub sex: String,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub title: Option<String>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub w_title: Option<String>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub o_title: Option<String>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub foa_title: Option<String>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rating: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub games: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub k: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rapid_rating: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rapid_games: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub rapid_k: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub blitz_rating: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub blitz_games: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub blitz_k: Option<u16>,
    #[serde(deserialize_with = "deserialize_option_u16")]
    pub birthday: Option<u16>,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub flag: Option<String>,
}

fn empty_string_is_none<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.is_empty() {
        Ok(None)
    } else {
        Ok(Some(s))
    }
}

fn deserialize_option_u16<'de, D>(deserializer: D) -> Result<Option<u16>, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(Option::deserialize(deserializer).unwrap_or(None))
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PlayersList {
    #[serde(rename = "player")]
    pub players: Vec<FidePlayer>,
}

#[tauri::command]
pub async fn download_fide_db(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    let fide_path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        "fide.bin",
        Some(BaseDirectory::AppData),
    )?;

    download_file(
        0,
        "http://ratings.fide.com/download/players_list_xml.zip".to_string(),
        app_config_dir(&app.config()).unwrap(),
        app.clone(),
        None,
        Some(false),
    )
    .await?;

    let xml_path = resolve_path(
        &app.config(),
        app.package_info(),
        &app.env(),
        "players_list_xml_foa.xml",
        Some(BaseDirectory::AppData),
    )?;

    let reader = BufReader::new(File::open(&xml_path)?);
    let players_list: PlayersList = from_reader(reader)?;

    let mut out_file = BufWriter::new(File::create(&fide_path)?);
    bincode::encode_into_std_write(&players_list.players, &mut out_file, config::standard())?;

    let mut fide_players = state.fide_players.write().await;
    *fide_players = players_list.players;

    app.emit_all(
        "download_progress",
        crate::fs::ProgressPayload {
            progress: 100.0,
            id: 0,
            finished: true,
        },
    )?;

    remove_file(&xml_path)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn find_fide_player(
    player: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Option<FidePlayer>, Error> {
    let fide_players = state.fide_players.read().await;

    if fide_players.is_empty() {
        drop(fide_players);
        let config = config::standard();
        let fide_path = resolve_path(
            &app.config(),
            app.package_info(),
            &app.env(),
            "fide.bin",
            Some(BaseDirectory::AppData),
        )?;

        if let Ok(f) = File::open(&fide_path) {
            let mut fide_players = state.fide_players.write().await;
            *fide_players = bincode::decode_from_reader(BufReader::new(f), config)?;
        }
    }

    let fide_players = state.fide_players.read().await;
    let mut best_match = None;
    let mut best_match_score = 0.0;

    for fide_player in (*fide_players).iter() {
        let score = jaro_winkler(&player, &fide_player.name);
        if score > best_match_score {
            best_match = Some(fide_player);
            best_match_score = score;
        }
    }

    if best_match_score > 0.8 {
        Ok(best_match.cloned())
    } else {
        Err(Error::NoMatchFound)
    }
}
