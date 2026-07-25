class Canirun < Formula
  desc "CLI to evaluate AI model compatibility on local hardware"
  homepage "https://github.com/estephanobrusa/canirun"
  url "https://github.com/estephanobrusa/canirun/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "9f1c013b7161e2267a8439e6be0a0cf328a1b7b4a092825c37092974934ad423"
  license "MIT"

  depends_on "node"

  def install
    # Install npm dependencies
    system "npm", "install", "--production", "--ignore-scripts"

    # Build TypeScript
    system "npm", "run", "build"

    # Install files
    libexec.install Dir["*"]

    # Create shell shim
    (bin/"canirun").write <<~EOS
      #!/bin/bash
      exec node "#{libexec}/dist/cli.js" "$@"
    EOS
  end

  test do
    output = shell_output("#{bin}/canirun --help")
    assert_match "canirun", output
    assert_match "--list", output
  end
end
