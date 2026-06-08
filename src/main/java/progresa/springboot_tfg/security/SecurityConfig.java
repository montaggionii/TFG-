package progresa.springboot_tfg.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.SecurityContextHolderFilter;

@Configuration
@EnableWebSecurity

public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthEntryPoint jwtAuthEntryPoint;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            JwtAuthEntryPoint jwtAuthEntryPoint
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.jwtAuthEntryPoint = jwtAuthEntryPoint;
    }
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(jwtAuthEntryPoint)
                )
                .authorizeHttpRequests(auth -> auth

                        .requestMatchers(
                                "/",
                                "/ping",
                                "/uploads/**",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html"
                        ).permitAll()
                        .requestMatchers("/api/auth/**").permitAll()

                        .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")

                        .requestMatchers(HttpMethod.POST, "/api/usuarios/identificar-qr").hasAuthority("ROLE_RESTAURANT")
                        .requestMatchers("/api/usuarios/**").hasAuthority("ROLE_USER")
                        .requestMatchers("/api/movimientos/**").hasAuthority("ROLE_USER")
                        .requestMatchers("/api/puntos/**").hasAnyAuthority("ROLE_USER", "ROLE_RESTAURANT")
                        .requestMatchers("/api/canjes/**").hasAuthority("ROLE_USER")

                        .requestMatchers(HttpMethod.GET, "/api/restaurantes/**").hasAnyAuthority("ROLE_USER", "ROLE_RESTAURANT")
                        .requestMatchers(HttpMethod.GET, "/api/promociones/**").hasAnyAuthority("ROLE_USER", "ROLE_RESTAURANT")
                        .requestMatchers(HttpMethod.GET, "/api/recompensas/**").hasAnyAuthority("ROLE_USER", "ROLE_RESTAURANT")
                        .requestMatchers("/api/recompensas/**").hasAuthority("ROLE_RESTAURANT")

                        .requestMatchers("/api/restaurantes/**").hasAuthority("ROLE_RESTAURANT")
                        .requestMatchers("/api/promociones/**").hasAuthority("ROLE_RESTAURANT")
                        .requestMatchers("/api/compras/**").hasAuthority("ROLE_RESTAURANT")








                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }


    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
