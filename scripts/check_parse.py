"""Ad-hoc validation: parse a Fountain file and print structural stats."""

import sys
from pathlib import Path

from EncorePlay.backend.fountain_parser import parse_fountain


def main() -> None:
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    play = parse_fountain(text)

    print("title:", play.title)
    print("author:", play.author)
    print("acts:", len(play.acts))
    for act in play.acts:
        print(" act", act.act_number, repr(act.title), "scenes:", len(act.scenes))
        for scene in act.scenes[:3]:
            print("   scene", scene.scene_number, repr(scene.title), "elements:", len(scene.elements))
    print("characters:", len(play.characters))
    print("sample characters:", [c.name for c in play.characters[:10]])


if __name__ == "__main__":
    main()
