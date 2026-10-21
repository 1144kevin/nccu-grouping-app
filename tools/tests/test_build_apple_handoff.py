import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("handoff", Path(__file__).parents[1] / "build_apple_handoff.py")
handoff = importlib.util.module_from_spec(spec)
spec.loader.exec_module(handoff)


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.hooks = self.root / "empty-hooks"
        self.hooks.mkdir()
        self.app, self.backend = self.root / "app", self.root / "backend"
        for repo in (self.app, self.backend):
            repo.mkdir()
            self.git(repo, "init")
            (repo / "old.txt").write_text("before")
            (repo / "signing.p12").write_text("old certificate fixture")
            self.git(repo, "add", ".")
            self.git(repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture")

    def git(self, repo, *args):
        return subprocess.check_output(["git", "-c", f"core.hooksPath={self.hooks}", "-c", "commit.gpgSign=false", *args], cwd=repo, stderr=subprocess.PIPE)

    def test_exports_new_native_source_and_rename_with_verifiable_hashes(self):
        self.git(self.app, "mv", "old.txt", "new.txt")
        source = self.app / "modules/apple-intake/ios/Module.swift"
        source.parent.mkdir(parents=True)
        source.write_text("new native source")
        output = self.root / "handoff.zip"
        handoff.build_handoff(self.app, self.backend, output)
        with zipfile.ZipFile(output) as archive:
            manifest = json.loads(archive.read("MANIFEST.json"))
            self.assertIn("old.txt", manifest["repos"]["app"]["deleted_files"])
            self.assertEqual(archive.read("overlay/app/modules/apple-intake/ios/Module.swift"), b"new native source")
            self.assertIn(b"rename to new.txt", archive.read("patches/app-tracked.patch"))
            for name, info in manifest["files"].items():
                self.assertEqual(handoff.hashlib.sha256(archive.read(name)).hexdigest(), info["sha256"])

    def test_excludes_credentials_from_both_overlay_and_patch_and_sanitizes_team(self):
        (self.app / ".env").write_text("PRIVATE_ENV_FIXTURE")
        (self.app / ".env.example").write_text("EXAMPLE=true")
        (self.app / "signing.p12").write_text("PRIVATE_SIGNING_FIXTURE")
        (self.app / "project.pbxproj").write_text("DEVELOPMENT_TEAM = TEAM123456;\nDevice=00000000-0000000000000000;\n")
        outside = self.root / "outside.txt"
        outside.write_text("OUTSIDE_FIXTURE")
        try:
            (self.app / "external.txt").symlink_to(outside)
        except OSError:
            pass  # Some Windows accounts cannot create symlinks; other exclusions still run.
        output = self.root / "handoff.zip"
        handoff.build_handoff(self.app, self.backend, output)
        with zipfile.ZipFile(output) as archive:
            combined = b"\n".join(archive.read(name) for name in archive.namelist())
            for private in (b"PRIVATE_ENV_FIXTURE", b"PRIVATE_SIGNING_FIXTURE", b"OUTSIDE_FIXTURE", b"TEAM123456", b"00000000-0000000000000000"):
                self.assertNotIn(private, combined)
            self.assertEqual(archive.read("overlay/app/.env.example"), b"EXAMPLE=true")

    def test_refuses_accidental_overwrite(self):
        output = self.root / "handoff.zip"
        output.write_bytes(b"preserve existing file")
        with self.assertRaisesRegex(ValueError, "Output exists"):
            handoff.build_handoff(self.app, self.backend, output)
        self.assertEqual(output.read_bytes(), b"preserve existing file")

    def test_source_fixtures_are_not_rewritten_by_configuration_redaction(self):
        source = b'example = "DEVELOPMENT_TEAM = TEAM123456;"\ndevice = "00000000-0000000000000000"\n'
        (self.app / "fixture.py").write_bytes(source)
        output = self.root / "handoff.zip"
        handoff.build_handoff(self.app, self.backend, output)
        with zipfile.ZipFile(output) as archive:
            exported = archive.read("overlay/app/fixture.py")
            self.assertEqual(exported, source)
            compile(exported, "fixture.py", "exec")

    def test_archive_in_source_repo_does_not_include_its_previous_copy(self):
        output = self.app / "handoff.zip"
        output.write_bytes(b"OLD_ARCHIVE_FIXTURE")
        handoff.build_handoff(self.app, self.backend, output, overwrite=True)
        with zipfile.ZipFile(output) as archive:
            self.assertNotIn("overlay/app/handoff.zip", archive.namelist())


if __name__ == "__main__":
    unittest.main()
