terraform {
  required_providers {
    virtualbox = {
      source  = "terra-farm/virtualbox"
      version = "0.2.2-alpha.1"
    }
  }
}

resource "virtualbox_vm" "worker" {
  name   = "worker"
  image  = "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.ova"
  cpus   = 1
  memory = "1024 mib"

  network_adapter {
    type           = "bridged"
    host_interface = "enp0s3"
  }

  cloud_init = templatefile("${path.module}/cloud-init/worker.yml", {
    ssh_public_key = file("~/.ssh/id_ed25519.pub")
  })
}

resource "virtualbox_vm" "db" {
  name   = "db"
  image  = "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.ova"
  cpus   = 1
  memory = "1024 mib"

  network_adapter {
    type           = "bridged"
    host_interface = "enp0s3"
  }

  cloud_init = templatefile("${path.module}/cloud-init/db.yml", {
    ssh_public_key = file("~/.ssh/id_ed25519.pub")
  })
}

output "worker_ip" {
  value = virtualbox_vm.worker.network_adapter[0].ipv4_address
}

output "db_ip" {
  value = virtualbox_vm.db.network_adapter[0].ipv4_address
}