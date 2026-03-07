use serde::Deserialize;
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

#[derive(Deserialize, Clone, Debug)]
pub struct Content {
    pub name: String,
    pub title: String,
    pub welcome: String,
    pub bio: Bio,
    pub skills: HashMap<String, Vec<String>>,
    pub projects: Vec<Project>,
    pub contact: HashMap<String, ContactEntry>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct Bio {
    pub summary: String,
    pub education: Vec<String>,
    pub experience: Vec<Experience>,
    pub interests: Vec<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct Experience {
    pub role: String,
    pub company: String,
    pub period: String,
    pub highlights: Vec<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct Project {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub tech: Vec<String>,
    pub link: String,
    pub status: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ContactEntry {
    pub label: String,
    pub url: String,
    pub display: String,
}

thread_local! {
    static CONTENT_CACHE: RefCell<Option<Rc<Content>>> = const { RefCell::new(None) };
}

pub async fn load_content() -> Result<Rc<Content>, JsValue> {
    let cached = CONTENT_CACHE.with(|c| c.borrow().clone());
    if let Some(rc) = cached {
        return Ok(rc);
    }

    let window = web_sys::window().unwrap();
    let resp_value = JsFuture::from(window.fetch_with_str("data/content.json")).await?;
    let resp: web_sys::Response = resp_value.dyn_into()?;
    let text = JsFuture::from(resp.text()?).await?;
    let text_str = text.as_string().unwrap();
    let content: Content =
        serde_json::from_str(&text_str).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let rc = Rc::new(content);
    CONTENT_CACHE.with(|c| {
        *c.borrow_mut() = Some(Rc::clone(&rc));
    });
    Ok(rc)
}
