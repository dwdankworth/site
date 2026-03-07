use crate::commands::{CommandRegistry, CommandResult};

/// Register all easter egg commands into the registry.
pub fn register_easter_eggs(registry: &mut CommandRegistry) {
    registry.register("sudo", "", true);
    registry.register("hire me", "", true);
    registry.register("exit", "", true);
    registry.register("rm", "", true);
    registry.register("ls", "", true);
    registry.register("cd", "", true);
    registry.register("pwd", "", true);
    registry.register("whoami", "", true);
    registry.register("coffee", "", true);
    registry.register("matrix", "", true);
    registry.register("ping", "", true);
    registry.register("cat", "", true);
}

/// Execute an easter egg command. Returns None if the name is not an easter egg.
pub fn execute_easter_egg(name: &str, args: &[String]) -> Option<CommandResult> {
    match name {
        "sudo" => Some(CommandResult::Output(
            "Nice try. You don't have root access to my career. \n\nBut you *can* run `contact` to discuss opportunities.".to_string(),
        )),

        "hire me" => {
            let lines = [
                "## 🚀 Why You Should Hire Me\n",
                "---",
                "",
                "  ✅ 4 years shipping production ML at Microsoft",
                "  ✅ Builds AI-forward tools (you're looking at one)",
                "  ✅ Bridges the gap between research and production",
                "  ✅ Writes code that humans can actually read",
                "  ✅ Strong communicator who speaks both \"business\" and \"model weights\"",
                "",
                "---",
                "",
                "Convinced? Run `contact` to get in touch.",
            ];
            Some(CommandResult::Output(lines.join("\n")))
        }

        "exit" => Some(CommandResult::Output(
            "There is no exit. Only more portfolio. 🚪\n\nTry `help` to see what else you can explore.".to_string(),
        )),

        "rm" => {
            if args.join(" ").contains("-rf") {
                Some(CommandResult::Output(
                    "I appreciate the chaos energy, but no. \n\nMy portfolio is immutable. Try `projects` instead.".to_string(),
                ))
            } else {
                Some(CommandResult::Output(
                    "rm: permission denied. This terminal is read-only (mostly).".to_string(),
                ))
            }
        }

        "ls" => {
            let items = [
                "drwxr-xr-x  career/",
                "drwxr-xr-x  projects/",
                "drwxr-xr-x  skills/",
                "-rw-r--r--  ambition.txt",
                "-rw-r--r--  coffee_addiction.log",
                "-rw-r--r--  curiosity.dat",
                "-rwxr-xr-x  hustle.sh",
            ];
            let body = items.iter().map(|i| format!("  {}", i)).collect::<Vec<_>>().join("\n");
            Some(CommandResult::Output(format!("## ~/ \n\n{}", body)))
        }

        "cd" => Some(CommandResult::Output(
            "You can't `cd` out of this portfolio. You're stuck here with my accomplishments. 📂".to_string(),
        )),

        "pwd" => Some(CommandResult::Output(
            "/home/visitor/whitneys-amazing-portfolio".to_string(),
        )),

        "whoami" => Some(CommandResult::Output(
            "visitor — but the real question is... are you a recruiter? 👀\n\nRun `hire me` to find out why that matters.".to_string(),
        )),

        "coffee" => {
            let art = [
                "        ( (",
                "         ) )",
                "      ........",
                "      |      |]",
                "      \\      /",
                "       `----'",
                "",
                "  Here, have a virtual coffee. ☕",
                "  You'll need the energy to read",
                "  through all my accomplishments.",
            ];
            Some(CommandResult::Output(art.join("\n")))
        }

        "matrix" => Some(CommandResult::MatrixSignal),

        "ping" => Some(CommandResult::Output(
            "PONG 🏓\n\nLatency: 0ms (because this portfolio is blazing fast)".to_string(),
        )),

        "cat" => {
            let art = [
                "   /\\_/\\  ",
                "  ( o.o ) ",
                "   > ^ <  ",
                "",
                "  You said cat. Here's a cat. 🐱",
                "  For actual content, try `bio` or `projects`.",
            ];
            Some(CommandResult::Output(art.join("\n")))
        }

        _ => None,
    }
}
