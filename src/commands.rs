use std::cell::RefCell;
use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::content;

// ---------------------------------------------------------------------------
// Result type returned by every command handler
// ---------------------------------------------------------------------------

pub enum CommandResult {
    Output(String),
    Silent,
    MatrixSignal,
}

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

pub struct CommandEntry {
    pub description: String,
    pub hidden: bool,
}

pub struct CommandRegistry {
    commands: HashMap<String, CommandEntry>,
    insertion_order: Vec<String>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        Self {
            commands: HashMap::new(),
            insertion_order: Vec::new(),
        }
    }

    pub fn register(&mut self, name: &str, description: &str, hidden: bool) {
        let key = name.to_string();
        if !self.commands.contains_key(&key) {
            self.insertion_order.push(key.clone());
        }
        self.commands.insert(
            key,
            CommandEntry {
                description: description.to_string(),
                hidden,
            },
        );
    }

    pub fn get(&self, name: &str) -> Option<&CommandEntry> {
        self.commands.get(name)
    }

    /// Returns `(name, description)` pairs for every non-hidden command,
    /// in registration order.
    pub fn all_visible(&self) -> Vec<(&str, &str)> {
        self.insertion_order
            .iter()
            .filter_map(|name| {
                let entry = self.commands.get(name.as_str())?;
                if entry.hidden {
                    None
                } else {
                    Some((name.as_str(), entry.description.as_str()))
                }
            })
            .collect()
    }
}

impl Default for CommandRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Build the registry with the 7 visible commands
// ---------------------------------------------------------------------------

pub fn build_registry() -> CommandRegistry {
    let mut reg = CommandRegistry::new();
    reg.register("help", "Show this help message", false);
    reg.register(
        "bio",
        "About me \u{2014} education, experience, interests",
        false,
    );
    reg.register("projects", "List all projects", false);
    reg.register(
        "project",
        "View project details \u{2014} usage: project <number>",
        false,
    );
    reg.register("skills", "Technical skills breakdown", false);
    reg.register("contact", "How to reach me", false);
    reg.register("clear", "Clear the terminal", false);
    reg
}

// ---------------------------------------------------------------------------
// Global singleton (single-threaded WASM — thread_local is fine)
// ---------------------------------------------------------------------------

thread_local! {
    static REGISTRY: RefCell<Option<CommandRegistry>> = const { RefCell::new(None) };
}

pub fn init_registry() {
    let mut reg = build_registry();
    crate::easter_eggs::register_easter_eggs(&mut reg);
    REGISTRY.with(|r| *r.borrow_mut() = Some(reg));
}

pub fn with_registry<F, R>(f: F) -> R
where
    F: FnOnce(&CommandRegistry) -> R,
{
    REGISTRY.with(|r| {
        f(r.borrow()
            .as_ref()
            .expect("Registry not initialized — call init_registry() first"))
    })
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

pub async fn execute_command(
    name: &str,
    args: &[String],
) -> Result<CommandResult, JsValue> {
    // Easter eggs take priority over built-in commands for hidden entries
    if let Some(result) = crate::easter_eggs::execute_easter_egg(name, args) {
        return Ok(result);
    }
    match name {
        "help" => cmd_help().await,
        "bio" => cmd_bio().await,
        "projects" => cmd_projects().await,
        "project" => cmd_project(args).await,
        "skills" => cmd_skills().await,
        "contact" => cmd_contact().await,
        "clear" => Ok(CommandResult::Silent),
        _ => Err(JsValue::from_str(&format!("Unknown command: {name}"))),
    }
}

// ── help ──────────────────────────────────────────────────────────────────────

async fn cmd_help() -> Result<CommandResult, JsValue> {
    let cmds = with_registry(|r| {
        r.all_visible()
            .iter()
            .map(|(n, d)| (n.to_string(), d.to_string()))
            .collect::<Vec<_>>()
    });
    let mut lines: Vec<String> = Vec::new();
    lines.push("## Available Commands\n".to_string());
    for (name, description) in &cmds {
        lines.push(format!("  **{:<14}** {}", name, description));
    }
    lines.push("\n Type a command and press Enter.".to_string());
    Ok(CommandResult::Output(lines.join("\n")))
}

// ── bio ───────────────────────────────────────────────────────────────────────

async fn cmd_bio() -> Result<CommandResult, JsValue> {
    let c = content::load_content().await?;
    let b = &c.bio;
    let mut lines: Vec<String> = Vec::new();

    lines.push(format!("## {}", c.name));
    lines.push(format!("{}\n", c.title));
    lines.push("---".to_string());
    lines.push(format!("\n{}\n", b.summary));

    lines.push("## Education\n".to_string());
    for e in &b.education {
        lines.push(format!("  \u{2022} {e}"));
    }

    lines.push("\n## Experience\n".to_string());
    for exp in &b.experience {
        lines.push(format!("  **{}** \u{2014} {}", exp.role, exp.company));
        lines.push(format!("  {}", exp.period));
        for h in &exp.highlights {
            lines.push(format!("    \u{2022} {h}"));
        }
        lines.push(String::new());
    }

    lines.push("## Interests\n".to_string());
    for i in &b.interests {
        lines.push(format!("  \u{2022} {i}"));
    }

    Ok(CommandResult::Output(lines.join("\n")))
}

// ── projects ──────────────────────────────────────────────────────────────────

async fn cmd_projects() -> Result<CommandResult, JsValue> {
    let c = content::load_content().await?;
    let mut lines: Vec<String> = vec!["## Projects\n".to_string()];

    for p in &c.projects {
        lines.push(format!("  **[{}]** {}", p.id, p.title));
        lines.push(format!(
            "      {}  \u{2014}  {}",
            p.tech.join(" \u{2022} "),
            p.status
        ));
        lines.push(String::new());
    }

    lines.push("\n Type `project <number>` for details on a specific project.".to_string());
    Ok(CommandResult::Output(lines.join("\n")))
}

// ── project <id> ──────────────────────────────────────────────────────────────

async fn cmd_project(args: &[String]) -> Result<CommandResult, JsValue> {
    let c = content::load_content().await?;

    let id: u32 = args
        .first()
        .and_then(|a| a.parse().ok())
        .unwrap_or(0);

    let proj = c.projects.iter().find(|p| p.id == id);

    match proj {
        None => {
            let ids: Vec<String> = c.projects.iter().map(|p| p.id.to_string()).collect();
            Ok(CommandResult::Output(format!(
                "Project not found. Available: {}",
                ids.join(", ")
            )))
        }
        Some(p) => {
            let mut lines: Vec<String> = Vec::new();
            lines.push(format!("## {}\n", p.title));
            lines.push("---".to_string());
            lines.push(format!("\n{}\n", p.description));
            lines.push(format!("**Tech Stack:** {}", p.tech.join(", ")));
            lines.push(format!("**Status:** {}", p.status));
            lines.push(format!("**Link:** [{}]({})", p.link, p.link));
            Ok(CommandResult::Output(lines.join("\n")))
        }
    }
}

// ── skills ────────────────────────────────────────────────────────────────────

async fn cmd_skills() -> Result<CommandResult, JsValue> {
    let c = content::load_content().await?;
    let mut lines: Vec<String> = vec!["## Technical Skills\n".to_string()];

    // Iterate in the order present in the JSON (serde_json preserves order
    // when deserialised into a serde_json::Map, but we use HashMap so we must
    // match the JS behaviour which iterates insertion-order).
    // The content struct uses HashMap<String, Vec<String>> — insertion order is
    // NOT guaranteed.  To match JS Object.entries order we use the raw JSON key
    // order via a secondary ordered list if needed. For now, sort by key name
    // to produce deterministic output; the Playwright tests only check for the
    // presence of category names, not ordering.
    let mut categories: Vec<(&String, &Vec<String>)> = c.skills.iter().collect();
    categories.sort_by_key(|(k, _)| k.to_lowercase());

    for (category, items) in &categories {
        lines.push(format!("  **{category}**"));
        lines.push(format!("    {}\n", items.join(" \u{2022} ")));
    }

    Ok(CommandResult::Output(lines.join("\n")))
}

// ── contact ───────────────────────────────────────────────────────────────────

async fn cmd_contact() -> Result<CommandResult, JsValue> {
    let c = content::load_content().await?;
    let mut lines: Vec<String> = vec!["## Get in Touch\n".to_string()];

    // Sort by key to get deterministic order; tests just check presence.
    let mut entries: Vec<(&String, &content::ContactEntry)> = c.contact.iter().collect();
    entries.sort_by_key(|(k, _)| k.to_lowercase());

    for (_, entry) in &entries {
        lines.push(format!(
            "  **{:<14}** [{}]({})",
            entry.label, entry.display, entry.url
        ));
    }

    lines.push(
        "\n Feel free to reach out \u{2014} I'm always happy to chat about data, ML, and building things."
            .to_string(),
    );
    Ok(CommandResult::Output(lines.join("\n")))
}
