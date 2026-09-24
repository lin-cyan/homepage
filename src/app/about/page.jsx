import React from "react";
import styles from './page.module.css'
import Image from "next/image";
import Button from "@/components/Button/Button";
import Me from "/public/me.png"
const About = () => {
    return(
        <div className={styles.container}>
            <div className={styles.imgContainer}>
            <Image fill={true} src='https://images.pexels.com/photos/9589493/pexels-photo-9589493.jpeg?auto=compress&cs=tinysrgb&w=1600&lazy=load' alt='' className={styles.img} />
            <div className={styles.imgText}>
                <h1  className={styles.imgTitle}>Linqing Li</h1>
                <h2 className={styles.imgDesc}>One Must Imagine Sisyphus Hopeful</h2> 
            </div>
            <div className={styles.imgMe}><Image src={Me} alt="Me" height={230} /></div>
            </div>
            <div className={styles.textContainer}>
                <div className={styles.item}>
                    <h1 className={styles.title}>Skills</h1>
                    <p>
                    Specializing in advanced backend development, with experince in Java, C++ and Node.js. Highly proficient in integrating AWS cloud services and related DevOps methodologies. Demonstrated leadership in driving the development of robust applications within a collaborative team environment. Possesses strong analytical and problem-solving abilities.
                    </p>
                </div>
                <div className={styles.item}>
                    <h1 className={styles.title}>Who am I</h1>
                    <p>
                        Hello, my name is <b className={styles.text_color}>Linqing</b>. I am an 💻 <b className={styles.text_color_golden}>Engineer</b> 🌐, 
                        In addition to my primary career, I have a fervent interest in 🖼️ <b className={styles.text_color_golden}>Computer Graphics </b>🎨, an art form that interprets the world through digital canvases.
                        I also cherish writing poetry, drawing inspiration from the works of my favorite poet, <b className={styles.text_color}>Pablo Neruda</b>. 🌟 
                        My passion has steered me towards exploring exciting career opportunities💼🔍. Feel free to contact me at <b className={styles.text_color_orange}>lancellq@gmail.com</b>
                    </p>
                    <Button url="/portfolio" text="See my works" />
                </div>

            </div>

        </div>
    )
}

export default About;