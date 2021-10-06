<template>
  <div class="container">
    <div class="aside">
      <p>aside</p>
      <p>
        {{ position }}
      </p>
    </div>
    <div class="main">
      <AccurateCropper
        :src="src"
        :zoom.sync="zoom"
        :position.sync="position"
      ></AccurateCropper>
    </div>
  </div>
</template>

<script>
import AccurateCropper from './components/AccurateCropper.vue'
import girl from './assets/girl.jpeg'
const sleep = (delay = 500) => new Promise((resolve) => setTimeout(() => resolve(), delay))
export default {
  components: {
    AccurateCropper
  },
  data () {
    return {
      src: '',
      zoom: 1,
      position: {}
    }
  },
  created () {
    this.init()
  },
  methods: {
    async init () {
      await sleep(1500)
      this.src = girl
      this.zoom = 1.5
      this.position = { left: 281, top: 389, width: 68, height: 345 }
    }
  }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
}
.container {
  height: 100vh;
  display: flex;
}
.aside {
  width: 200px;
  background: #d3dce6;
  color: #333;
  text-align: center;
}
.main {
  flex: 1;
}
</style>